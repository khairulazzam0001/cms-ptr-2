import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { google, sheets_v4 } from 'googleapis';
import { Repository } from 'typeorm';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from '../assessment/entities';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

type SyncResult = { tab: string; rows: number };
type Table = { tab: string; values: (string | number)[][] };

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private client: sheets_v4.Sheets | null = null;
  lastSyncAt: string | null = null;
  lastSummary: SyncResult[] = [];

  constructor(
    @InjectRepository(Level) private levels: Repository<Level>,
    @InjectRepository(Design) private designs: Repository<Design>,
    @InjectRepository(Competency) private competencies: Repository<Competency>,
    @InjectRepository(Simulation) private simulations: Repository<Simulation>,
    @InjectRepository(AssessmentDesign) private adesigns: Repository<AssessmentDesign>,
    @InjectRepository(AssessmentDesignDetailCompetency)
    private detailComp: Repository<AssessmentDesignDetailCompetency>,
    @InjectRepository(AssessmentDesignDetailSimulation)
    private detailSim: Repository<AssessmentDesignDetailSimulation>,
  ) {}

  get enabled() {
    return (process.env.SHEETS_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
  }
  get spreadsheetId() {
    return process.env.GOOGLE_SPREADSHEET_ID ?? '';
  }
  get cron() {
    return process.env.SHEETS_CRON ?? '0 * * * *';
  }

  status() {
    return {
      enabled: this.enabled,
      spreadsheetIdSet: !!this.spreadsheetId,
      credentialsSet: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE),
      cron: this.cron,
      lastSyncAt: this.lastSyncAt,
      lastSummary: this.lastSummary,
    };
  }

  private async sheets(): Promise<sheets_v4.Sheets> {
    if (this.client) return this.client;
    if (!this.spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID belum diisi di .env');
    const raw =
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_FILE
        ? await import('fs/promises').then((fs) =>
            fs.readFile(process.env.GOOGLE_SERVICE_ACCOUNT_FILE as string, 'utf8'),
          )
        : '');
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_FILE belum diisi');
    const creds = JSON.parse(raw);
    const key = String(creds.private_key ?? '').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({ email: creds.client_email, key, scopes: SCOPES });
    this.client = google.sheets({ version: 'v4', auth });
    return this.client;
  }

  private async writeTab(svc: sheets_v4.Sheets, tab: string, values: (string | number)[][]) {
    // buat tab bila belum ada (abaikan error "already exists")
    try {
      await svc.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
      });
    } catch (e: any) {
      if (!String(e?.message ?? '').includes('already exists')) throw e;
    }
    await svc.spreadsheets.values.clear({ spreadsheetId: this.spreadsheetId, range: tab });
    await svc.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  /** Kumpulkan SEMUA master sebagai tabel (dipakai sync Sheets + download CSV lokal). */
  async collectTables(): Promise<Table[]> {
    const lv = await this.levels.find({ where: { is_deleted: false }, order: { level_id: 'ASC' } });
    const dg = await this.designs.find({ where: { is_deleted: false }, order: { design_id: 'ASC' } });
    const cp = await this.competencies.find({ where: { is_deleted: false }, order: { competency_id: 'ASC' } });
    const sm = await this.simulations.find({ where: { is_deleted: false }, order: { simulation_id: 'ASC' } });
    const ad = await this.adesigns.find({ where: { is_deleted: false }, order: { assessment_design_id: 'ASC' } });
    const adRows: (string | number)[][] = [['assessment_design_id', 'assessment_design_name', 'level_id', 'design_id', 'competency_count', 'simulation_count']];
    for (const r of ad) {
      const [cc, sc] = await Promise.all([
        this.detailComp.count({ where: { assessment_design_id: r.assessment_design_id, is_deleted: false } }),
        this.detailSim.count({ where: { assessment_design_id: r.assessment_design_id, is_deleted: false } }),
      ]);
      adRows.push([r.assessment_design_id, r.assessment_design_name, r.level_id ?? '', r.design_id ?? '', cc, sc]);
    }
    const dc = await this.detailComp.find({ where: { is_deleted: false }, relations: ['competency'] });
    const ds = await this.detailSim.find({
      where: { is_deleted: false },
      relations: ['simulation'],
      order: { sequence: 'ASC' },
    });
    return [
      { tab: 'levels', values: [['level_id', 'level_name', 'level_desc'], ...lv.map((r) => [r.level_id, r.level_name, r.level_desc ?? ''])] },
      { tab: 'designs', values: [['design_id', 'design_name', 'design_desc'], ...dg.map((r) => [r.design_id, r.design_name, r.design_desc ?? ''])] },
      { tab: 'competencies', values: [['competency_id', 'competency_name', 'group_competency_id', 'competency_desc', 'level_id'], ...cp.map((r) => [r.competency_id, r.competency_name, r.group_competency_id ?? '', r.competency_desc ?? '', r.level_id ?? ''])] },
      { tab: 'simulations', values: [['simulation_id', 'simulation_name', 'simulation_desc', 'duration', 'channel_name', 'group_simulation_id', 'level_id', 'status'], ...sm.map((r) => [r.simulation_id, r.simulation_name, r.simulation_desc ?? '', r.duration, r.channel_name ?? '', r.group_simulation_id ?? '', r.level_id ?? '', r.status])] },
      { tab: 'assessment_designs', values: adRows },
      { tab: 'design_competencies', values: [['assessment_design_id', 'competency_id', 'competency_name'], ...dc.map((r) => [r.assessment_design_id, r.competency_id, r.competency?.competency_name ?? ''])] },
      { tab: 'design_simulations', values: [['assessment_design_id', 'simulation_id', 'simulation_name', 'sequence', 'duration'], ...ds.map((r) => [r.assessment_design_id, r.simulation_id, r.simulation?.simulation_name ?? '', r.sequence, r.simulation?.duration ?? 0])] },
    ];
  }

  /** Download CSV lokal per tabel — tanpa Google, tanpa batasan kuota. */
  async exportCsv(tab: string): Promise<{ filename: string; csv: string }> {
    const tables = await this.collectTables();
    const t = tables.find((x) => x.tab === tab);
    if (!t) throw new Error(`Tabel tidak dikenal: ${tab}. Pilih: ${tables.map((x) => x.tab).join(', ')}`);
    return { filename: `${tab}.csv`, csv: t.values.map((r) => r.map(csvCell).join(',')).join('\r\n') };
  }

  /** Sync SEMUA master ke spreadsheet (1 tab per tabel). Dipakai scheduler + tombol manual. */
  async syncAll(): Promise<{ spreadsheetId: string; syncedAt: string; summary: SyncResult[] }> {
    if (!this.enabled) throw new Error('SHEETS_SYNC_ENABLED=false — aktifkan dulu di .env');
    const svc = await this.sheets();
    const tables = await this.collectTables();
    const summary: SyncResult[] = [];
    for (const t of tables) {
      await this.writeTab(svc, t.tab, t.values);
      summary.push({ tab: t.tab, rows: t.values.length - 1 });
    }

    this.lastSyncAt = new Date().toISOString();
    this.lastSummary = summary;
    this.logger.log(`Sheets sync OK: ${summary.map((s) => `${s.tab}=${s.rows}`).join(', ')}`);
    return { spreadsheetId: this.spreadsheetId, syncedAt: this.lastSyncAt, summary };
  }
}
