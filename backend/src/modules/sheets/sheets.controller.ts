import { Controller, Get, Header, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DriveService } from './drive.service';
import { SheetsService } from './sheets.service';

@Controller('sheets')
export class SheetsController {
  constructor(private sheets: SheetsService, private drive: DriveService) {}

  @Get('status')
  status() {
    return { sheets: this.sheets.status(), drive: this.drive.status() };
  }

  // Download CSV lokal per tabel (tanpa Google). Contoh: GET /api/sheets/export/simulations
  @Get('export/:tab')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Param('tab') tab: string, @Res({ passthrough: true }) res: Response) {
    try {
      const { filename, csv } = await this.sheets.exportCsv(tab);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return '﻿' + csv; // BOM agar Excel baca UTF-8 dengan benar
    } catch (e: any) {
      throw new NotFoundException(e?.message ?? 'Export gagal');
    }
  }

  // Tombol manual "Sync sekarang" di frontend
  @Post('sync')
  sync() {
    return this.sheets.syncAll();
  }

  @Post('sync-drive')
  syncDrive() {
    return this.drive.syncAll();
  }
}
