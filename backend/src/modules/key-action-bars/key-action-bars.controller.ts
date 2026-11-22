import { Body, Controller, Delete, Get, HttpCode, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUsername } from '../../common/decorators/current-user.decorator';
import { MAX_FILE_BYTES } from './bars-format';
import { BarsExportQueryDto, BarsSimulationDto, BarsTemplateQueryDto } from './dto';
import { KeyActionBarsService } from './key-action-bars.service';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// File diproses di memori, tidak ditulis ke /uploads. Melebihi batas -> 413.
const xlsxUpload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
const download = ({ buffer, filename }: { buffer: Buffer; filename: string }) =>
  new StreamableFile(buffer, { type: XLSX_TYPE, disposition: `attachment; filename="${filename}"` });

// Import / export BARS & behaviour via Excel (PRD_Import_BARS.md §8)
@Controller('key-action-bars')
export class KeyActionBarsController {
  constructor(private svc: KeyActionBarsService) {}

  @Get('template') async template(@Query() q: BarsTemplateQueryDto) {
    return download(await this.svc.template(q.simulation_id || undefined, q.format));
  }

  @Get('export') async export(@Query() q: BarsExportQueryDto) {
    return download(await this.svc.export(q.simulation_id, q.format));
  }

  @Get('summary') summary(@Query() q: BarsSimulationDto) {
    return this.svc.summary(q.simulation_id);
  }

  // Hard delete BARS + behaviour per simulation (dipakai halaman Key Action Matrix)
  @Delete() purge(@Query() q: BarsSimulationDto) {
    return this.svc.purge(q.simulation_id);
  }

  @Post('import/preview') @HttpCode(200) @UseInterceptors(xlsxUpload)
  preview(@Body() dto: BarsSimulationDto, @UploadedFile() file: Express.Multer.File) {
    return this.svc.preview(dto.simulation_id, file);
  }

  @Post('import') @HttpCode(200) @UseInterceptors(xlsxUpload)
  import(@Body() dto: BarsSimulationDto, @UploadedFile() file: Express.Multer.File, @CurrentUsername() user: string) {
    return this.svc.import(dto.simulation_id, file, user);
  }
}
