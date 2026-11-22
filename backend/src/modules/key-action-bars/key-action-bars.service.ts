import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Simulation } from '../assessment/entities';
import { KeyAction, KeyActionBars, KeyActionBarsBehaviour } from '../assessment-data/entities';
import { BARS_TYPES, FileFormat, MAX_ERRORS_SHOWN, ParsedBars, RowError } from './bars-format';
import { ImportPlan, planImport } from './bars-diff';
import { cleanText, parseBarsRows, parseMatrixRows } from './bars-parser';
import { ExportRow, ReferenceKeyAction, UploadedXlsx, readBarsWorkbook, writeBarsWorkbook } from './bars-workbook';

// Import / export BARS & behaviour per simulation (PRD_Import_BARS.md).
const CHUNK = 500;
const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));
const TYPE_ORDER = new Map<string, number>(BARS_TYPES.map((t, i) => [t, i]));

type Parsed = { simulation: Simulation; bars: ParsedBars[]; errors: RowError[]; warnings: string[]; rowsRead: number; format: FileFormat };

@Injectable()
export class KeyActionBarsService {
  constructor(
    @InjectRepository(Simulation) private simulations: Repository<Simulation>,
    @InjectRepository(KeyAction) private keyActions: Repository<KeyAction>,
    @InjectRepository(KeyActionBars) private bars: Repository<KeyActionBars>,
    @InjectRepository(KeyActionBarsBehaviour) private behaviours: Repository<KeyActionBarsBehaviour>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async preview(simulationId: string, file: UploadedXlsx | undefined) {
    const parsed = await this.parse(simulationId, file);
    const plan = await this.plan(this.dataSource.manager, simulationId, parsed.bars);
    return this.result(parsed, plan);
  }

  // Validasi ulang (tidak mempercayai preview), lalu simpan atomik (FR-IB-30..32)
  async import(simulationId: string, file: UploadedXlsx | undefined, username: string) {
    const parsed = await this.parse(simulationId, file);
    if (parsed.errors.length) {
      throw new BadRequestException({
        message: 'File tidak valid',
        errors: parsed.errors.slice(0, MAX_ERRORS_SHOWN),
        error_total: parsed.errors.length,
      });
    }
    const plan = await this.dataSource.transaction(async (m) => {
      // kunci simulation: import bersamaan untuk simulation yang sama berjalan bergantian
      await m.findOne(Simulation, { where: { simulation_id: simulationId }, lock: { mode: 'pessimistic_write' } });
      const p = await this.plan(m, simulationId, parsed.bars);
      await this.apply(m, simulationId, p, username);
      return p;
    });
    return this.result(parsed, plan);
  }

  async summary(simulationId: string) {
    await this.findSimulation(simulationId);
    const rows: { bars_type: string; n: string }[] = await this.bars
      .createQueryBuilder('b')
      .select('b.bars_type', 'bars_type')
      .addSelect('COUNT(*)', 'n')
      .where('b.simulation_id = :sid AND b.is_deleted = false', { sid: simulationId })
      .groupBy('b.bars_type')
      .getRawMany();
    const behaviourCount = await this.behaviours
      .createQueryBuilder('h')
      .innerJoin(KeyActionBars, 'b', 'b.bars_id = h.bars_id')
      .where('b.simulation_id = :sid AND b.is_deleted = false AND h.is_deleted = false', { sid: simulationId })
      .getCount();
    const bars = Object.fromEntries(BARS_TYPES.map((t) => [t, Number(rows.find((r) => r.bars_type === t)?.n ?? 0)]));
    return { simulation_id: simulationId, bars, bars_total: rows.reduce((s, r) => s + Number(r.n), 0), behaviours: behaviourCount };
  }

  async template(simulationId?: string, format: FileFormat = 'matrix') {
    const simulation = simulationId ? await this.findSimulation(simulationId) : null;
    const buffer = await writeBarsWorkbook({ simulation, rows: [], keyActions: await this.referenceKeyActions(), format });
    return { buffer, filename: 'BARS_template.xlsx' };
  }

  async export(simulationId: string, format: FileFormat = 'matrix') {
    const simulation = await this.findSimulation(simulationId);
    const keyActions = await this.keyActions.find({ where: { is_deleted: false } });
    const kaOrder = new Map(keyActions.map((k) => [k.key_action_id, k]));
    const bars = await this.bars.find({ where: { simulation_id: simulationId, is_deleted: false }, relations: ['behaviours'] });
    bars.sort((a, b) => {
      const ka = kaOrder.get(a.key_action_id), kb = kaOrder.get(b.key_action_id);
      return (
        (ka?.competency_id ?? '').localeCompare(kb?.competency_id ?? '') ||
        (ka?.sort_order ?? 0) - (kb?.sort_order ?? 0) ||
        a.key_action_id.localeCompare(b.key_action_id) ||
        (TYPE_ORDER.get(a.bars_type ?? '') ?? 9) - (TYPE_ORDER.get(b.bars_type ?? '') ?? 9) ||
        a.sort_order - b.sort_order
      );
    });
    const rows: ExportRow[] = [];
    for (const b of bars) {
      const base = {
        key_action_id: b.key_action_id,
        bars_type: b.bars_type ?? '',
        bars_no: b.sort_order,
        bars_name: b.bars_name ?? '',
        need_ai: b.need_ai,
      };
      const active = (b.behaviours ?? []).filter((h) => !h.is_deleted).sort((x, y) => x.sort_order - y.sort_order);
      if (!active.length) rows.push({ ...base, behaviour_no: null, behaviour: null, weight: null });
      for (const h of active) rows.push({ ...base, behaviour_no: h.sort_order, behaviour: h.bars_behaviour ?? '', weight: h.weight ?? null });
    }
    const buffer = await writeBarsWorkbook({ simulation, rows, keyActions: await this.referenceKeyActions(), format });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return { buffer, filename: `BARS_${simulationId}_${date}.xlsx` };
  }

  // HARD DELETE semua BARS + behaviour milik simulation (termasuk yang sudah soft delete).
  // Pengecualian sengaja dari aturan soft delete (permintaan user); tidak bisa dibatalkan.
  // Behaviour dihapus dulu karena FK fk_bars_behaviour_action_bars ON DELETE RESTRICT.
  async purge(simulationId: string) {
    await this.findSimulation(simulationId);
    return this.dataSource.transaction(async (m) => {
      await m.findOne(Simulation, { where: { simulation_id: simulationId }, lock: { mode: 'pessimistic_write' } });
      const barsIds = m
        .createQueryBuilder()
        .subQuery()
        .select('b.bars_id')
        .from(KeyActionBars, 'b')
        .where('b.simulation_id = :sid')
        .getQuery();
      const behaviours = await m
        .createQueryBuilder()
        .delete()
        .from(KeyActionBarsBehaviour)
        .where(`bars_id IN ${barsIds}`, { sid: simulationId })
        .execute();
      const bars = await m.delete(KeyActionBars, { simulation_id: simulationId });
      return { simulation_id: simulationId, bars_deleted: bars.affected ?? 0, behaviours_deleted: behaviours.affected ?? 0 };
    });
  }

  // ---------- internal ----------

  private async parse(simulationId: string, file: UploadedXlsx | undefined): Promise<Parsed> {
    const simulation = await this.findSimulation(simulationId);
    const read = await readBarsWorkbook(file);
    const errors: RowError[] = [];
    if (read.infoSimulationId && read.infoSimulationId !== simulationId) {
      errors.push({ row: null, column: null, message: `File ini milik simulation "${read.infoSimulationId}", bukan "${simulationId}"` });
    }
    const valid = new Set((await this.keyActions.find({ where: { is_deleted: false }, select: { key_action_id: true } })).map((k) => k.key_action_id));
    const parsed =
      read.format === 'matrix'
        ? parseMatrixRows(read.matrixRows, simulationId, valid)
        : parseBarsRows(read.rows, simulationId, valid);
    errors.push(...parsed.errors);
    const warnings = read.unknownColumns.length ? [`Kolom tidak dikenal diabaikan: ${read.unknownColumns.join(', ')}`] : [];
    const rowsRead = read.format === 'matrix' ? read.matrixRows.length : read.rows.length;
    return { simulation, bars: parsed.bars, errors, warnings, rowsRead, format: read.format };
  }

  // Data simulation di DB termasuk yang sudah di-soft delete (ID yang sama dihidupkan lagi)
  private async plan(m: EntityManager, simulationId: string, parsed: ParsedBars[]): Promise<ImportPlan> {
    const existingBars = await m.find(KeyActionBars, { where: { simulation_id: simulationId } });
    const barsIds = existingBars.map((b) => b.bars_id);
    const existingBehaviours = barsIds.length ? await m.find(KeyActionBarsBehaviour, { where: { bars_id: In(barsIds) } }) : [];
    return planImport(parsed, existingBars, existingBehaviours);
  }

  private async apply(m: EntityManager, simulationId: string, p: ImportPlan, username: string) {
    for (const part of chunks(p.barsInsert)) {
      await m.insert(KeyActionBars, part.map((b) => ({
        bars_id: b.bars_id,
        key_action_id: b.key_action_id,
        bars_type: b.bars_type,
        bars_name: b.bars_name,
        sort_order: b.bars_no,
        need_ai: b.need_ai,
        simulation_id: simulationId,
        is_deleted: false,
        created_by: username,
        modified_by: username,
      })));
    }
    for (const b of p.barsUpdate) {
      await m.update(KeyActionBars, { bars_id: b.bars_id }, {
        bars_name: b.bars_name, sort_order: b.bars_no, need_ai: b.need_ai, is_deleted: false, modified_by: username,
      });
    }
    for (const part of chunks(p.behaviourInsert)) {
      await m.insert(KeyActionBarsBehaviour, part.map((h) => ({
        bars_behaviour_id: h.bars_behaviour_id,
        bars_id: h.bars_id,
        key_action_id: h.key_action_id,
        bars_behaviour: h.bars_behaviour,
        weight: h.weight,
        sort_order: h.behaviour_no,
        is_deleted: false,
        created_by: username,
        modified_by: username,
      })));
    }
    for (const h of p.behaviourUpdate) {
      await m.update(KeyActionBarsBehaviour, { bars_behaviour_id: h.bars_behaviour_id }, {
        bars_behaviour: h.bars_behaviour, weight: h.weight, sort_order: h.behaviour_no, is_deleted: false, modified_by: username,
      });
    }
    // Soft delete data yang tidak ada di file (FK RESTRICT tidak terpicu)
    for (const part of chunks(p.barsDelete)) {
      await m.update(KeyActionBars, { bars_id: In(part) }, { is_deleted: true, modified_by: username });
    }
    for (const part of chunks(p.behaviourDelete)) {
      await m.update(KeyActionBarsBehaviour, { bars_behaviour_id: In(part) }, { is_deleted: true, modified_by: username });
    }
  }

  private result(parsed: Parsed, plan: ImportPlan) {
    return {
      simulation_id: parsed.simulation.simulation_id,
      simulation_name: parsed.simulation.simulation_name,
      rows_read: parsed.rowsRead,
      format: parsed.format,
      valid: parsed.errors.length === 0,
      summary: plan.summary,
      errors: parsed.errors.slice(0, MAX_ERRORS_SHOWN),
      error_total: parsed.errors.length,
      warnings: parsed.warnings,
    };
  }

  private async findSimulation(simulationId: string) {
    const simulation = await this.simulations.findOne({ where: { simulation_id: simulationId, is_deleted: false } });
    if (!simulation) throw new NotFoundException(`Simulation "${simulationId}" tidak ditemukan`);
    return simulation;
  }

  private async referenceKeyActions(): Promise<ReferenceKeyAction[]> {
    const list = await this.keyActions.find({
      where: { is_deleted: false },
      relations: ['competency'],
      order: { competency_id: 'ASC', sort_order: 'ASC', key_action_id: 'ASC' },
    });
    return list.map((k) => ({
      key_action_id: k.key_action_id,
      key_action_name: cleanText(k.key_action_name),
      competency_id: k.competency_id,
      competency_name: cleanText(k.competency?.competency_name),
    }));
  }
}
