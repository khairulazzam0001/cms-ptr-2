import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
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

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

type CsvResult = { file: string; rows: number; action: 'created' | 'updated' };

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private client: drive_v3.Drive | null = null;
  lastSyncAt: string | null = null;
  lastSummary: CsvResult[] = [];

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
    return (process.env.DRIVE_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
  }
  get folderId() {
    return process.env.GOOGLE_DRIVE_FOLDER_ID ?? '';
  }
  get cron() {
    return process.env.DRIVE_CRON ?? '0 * * * *';
  }

  status() {
    return {
      enabled: this.enabled,
      folderIdSet: !!this.folderId,
      credentialsSet: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE),
      cron: this.cron,
      lastSyncAt: this.lastSyncAt,
      lastSummary: this.lastSummary,
    };
  }

  private async drive(): Promise<drive_v3.Drive> {
    if (this.client) return this.client;
    if (!this.folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID belum diisi di .env');
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
    this.client = google.drive({ version: 'v3', auth });
    return this.client;
  }

  private async upsertCsv(
    svc: drive_v3.Drive,
    filename: string,
    content: string,
  ): Promise<CsvResult> {
    const q = `name = '${filename.replace(/'/g, "\\'")}' and '${this.folderId}' in parents and trashed = false`;
    const found = await svc.files.list({ q, fields: 'files(id, name)', pageSize: 1 });
    const media = { mimeType: 'text/csv', body: Readable.from([content]) };
    if (found.data.files?.length) {
      const id = found.data.files[0].id as string;
      await svc.files.update({ fileId: id, media });
      return { file: filename, rows: content.split('\r\n').length - 1, action: 'updated' };
    }
    await svc.files.create({
      requestBody: { name: filename, parents: [this.folderId], mimeType: 'text/csv' },
      media,
    });
    return { file: filename, rows: content.split('\r\n').length - 1, action: 'created' };
  }

  /** Sync SEMUA master sebagai file CSV ke folder Drive (overwrite per nama file). */
  async syncAll(): Promise<{ folderId: string; syncedAt: string; summary: CsvResult[] }> {
    if (!this.enabled) throw new Error('DRIVE_SYNC_ENABLED=false — aktifkan dulu di .env');
    const svc = await this.drive();
    const summary: CsvResult[] = [];

    const lv = await this.levels.find({ where: { is_deleted: false }, order: { level_id: 'ASC' } });
    summary.push(await this.upsertCsv(svc, 'levels.csv',
      toCsv(['level_id', 'level_name', 'level_desc'], lv.map((r) => [r.level_id, r.level_name, r.level_desc ?? '']))));

    const dg = await this.designs.find({ where: { is_deleted: false }, order: { design_id: 'ASC' } });
    summary.push(await this.upsertCsv(svc, 'designs.csv',
      toCsv(['design_id', 'design_name', 'design_desc'], dg.map((r) => [r.design_id, r.design_name, r.design_desc ?? '']))));

    const cp = await this.competencies.find({ where: { is_deleted: false }, order: { competency_id: 'ASC' } });
    summary.push(await this.upsertCsv(svc, 'competencies.csv',
      toCsv(['competency_id', 'competency_name', 'group_competency_id', 'competency_desc', 'level_id'],
        cp.map((r) => [r.competency_id, r.competency_name, r.group_competency_id ?? '', r.competency_desc ?? '', r.level_id ?? '']))));

    const sm = await this.simulations.find({ where: { is_deleted: false }, order: { simulation_id: 'ASC' } });
    summary.push(await this.upsertCsv(svc, 'simulations.csv',
      toCsv(['simulation_id', 'simulation_name', 'simulation_desc', 'duration', 'channel_name', 'group_simulation_id', 'level_id', 'status'],
        sm.map((r) => [r.simulation_id, r.simulation_name, r.simulation_desc ?? '', r.duration, r.channel_name ?? '', r.group_simulation_id ?? '', r.level_id ?? '', r.status]))));

    const ad = await this.adesigns.find({ where: { is_deleted: false }, order: { assessment_design_id: 'ASC' } });
    const adRows: (string | number)[][] = [];
    for (const r of ad) {
      const [cc, sc] = await Promise.all([
        this.detailComp.count({ where: { assessment_design_id: r.assessment_design_id, is_deleted: false } }),
        this.detailSim.count({ where: { assessment_design_id: r.assessment_design_id, is_deleted: false } }),
      ]);
      adRows.push([r.assessment_design_id, r.assessment_design_name, r.level_id ?? '', r.design_id ?? '', cc, sc]);
    }
    summary.push(await this.upsertCsv(svc, 'assessment_designs.csv',
      toCsv(['assessment_design_id', 'assessment_design_name', 'level_id', 'design_id', 'competency_count', 'simulation_count'], adRows)));

    const dc = await this.detailComp.find({ where: { is_deleted: false }, relations: ['competency'] });
    summary.push(await this.upsertCsv(svc, 'design_competencies.csv',
      toCsv(['assessment_design_id', 'competency_id', 'competency_name'],
        dc.map((r) => [r.assessment_design_id, r.competency_id, r.competency?.competency_name ?? '']))));

    const ds = await this.detailSim.find({ where: { is_deleted: false }, relations: ['simulation'], order: { sequence: 'ASC' } });
    summary.push(await this.upsertCsv(svc, 'design_simulations.csv',
      toCsv(['assessment_design_id', 'simulation_id', 'simulation_name', 'sequence', 'duration'],
        ds.map((r) => [r.assessment_design_id, r.simulation_id, r.simulation?.simulation_name ?? '', r.sequence, r.simulation?.duration ?? 0]))));

    this.lastSyncAt = new Date().toISOString();
    this.lastSummary = summary;
    this.logger.log(`Drive CSV sync OK: ${summary.map((s) => `${s.file}:${s.action}`).join(', ')}`);
    return { folderId: this.folderId, syncedAt: this.lastSyncAt, summary };
  }
}
