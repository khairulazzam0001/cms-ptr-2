import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUsername } from '../../common/decorators/current-user.decorator';
import { CreateUploadDocumentDto, UpdateUploadDocumentDto, UploadDocumentQueryDto } from './dto';
import { MAX_HTML_BYTES } from './html-file';
import { UploadDocumentsService } from './upload-documents.service';

// Memory storage: file HTML tidak pernah ditulis ke /uploads (yang diserve publik).
// Melebihi batas -> multer LIMIT_FILE_SIZE -> 413.
const htmlUpload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_HTML_BYTES, files: 1 } });

@Controller('upload-documents')
export class UploadDocumentsController {
  constructor(private svc: UploadDocumentsService) {}

  @Get() list(@Query() q: UploadDocumentQueryDto) { return this.svc.list(q); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }

  // Unduh sebagai attachment + nosniff: HTML tak tepercaya tidak dirender oleh browser
  @Get(':id/download')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(@Param('id') id: string) {
    const { filename, html } = await this.svc.download(id);
    return new StreamableFile(Buffer.from(html, 'utf8'), {
      type: 'text/html; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post()
  @UseInterceptors(htmlUpload)
  create(
    @Body() dto: CreateUploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUsername() user: string,
  ) {
    return this.svc.create(dto, file, user);
  }

  @Put(':id/file')
  @UseInterceptors(htmlUpload)
  replaceFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUsername() user: string) {
    return this.svc.replaceFile(id, file, user);
  }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUploadDocumentDto, @CurrentUsername() user: string) {
    return this.svc.update(id, dto, user);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUsername() user: string) { return this.svc.remove(id, user); }
}
