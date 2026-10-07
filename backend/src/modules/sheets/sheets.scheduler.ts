import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DriveService } from './drive.service';
import { SheetsService } from './sheets.service';

@Injectable()
export class SheetsScheduler implements OnModuleInit {
  private readonly logger = new Logger(SheetsScheduler.name);
  constructor(
    private sheets: SheetsService,
    private drive: DriveService,
    private registry: SchedulerRegistry,
  ) {}

  private addJob(name: string, cron: string, fn: () => Promise<unknown>) {
    try {
      const job = new CronJob(cron, async () => {
        try {
          await fn();
        } catch (e: any) {
          this.logger.error(`Scheduled ${name} gagal: ` + (e?.message ?? e));
        }
      });
      this.registry.addCronJob(name, job);
      job.start();
      this.logger.log(`Scheduler "${name}" jalan dengan cron "${cron}"`);
    } catch (e: any) {
      this.logger.error(`Cron "${cron}" untuk ${name} tidak valid: ` + (e?.message ?? e));
    }
  }

  onModuleInit() {
    const s = this.sheets.status();
    if (!s.enabled) {
      this.logger.log('Sheets scheduler NONAKTIF (SHEETS_SYNC_ENABLED != true)');
    } else if (!s.spreadsheetIdSet || !s.credentialsSet) {
      this.logger.warn('Sheets scheduler aktif tapi kredensial/spreadsheet belum lengkap — sync dilewati');
    } else {
      this.addJob('sheets-sync', s.cron, () => this.sheets.syncAll());
    }

    const d = this.drive.status();
    if (!d.enabled) {
      this.logger.log('Drive CSV scheduler NONAKTIF (DRIVE_SYNC_ENABLED != true)');
    } else if (!d.folderIdSet || !d.credentialsSet) {
      this.logger.warn('Drive CSV scheduler aktif tapi kredensial/folder belum lengkap — sync dilewati');
    } else {
      this.addJob('drive-csv-sync', d.cron, () => this.drive.syncAll());
    }
  }
}
