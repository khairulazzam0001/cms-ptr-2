import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUsername } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  DocumentQueryDto,
  DuplicateDocumentDto,
  FinalizeDocumentDto,
  SaveContentDto,
  UpdateDocumentDto,
} from './dto';

@Controller('documents')
export class DocumentsController {
  constructor(private svc: DocumentsService) {}

  @Get() list(@Query() q: DocumentQueryDto) { return this.svc.list(q); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() create(@Body() dto: CreateDocumentDto, @CurrentUsername() user: string) { return this.svc.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUsername() user: string) {
    return this.svc.update(id, dto, user);
  }
  @Put(':id/content') saveContent(@Param('id') id: string, @Body() dto: SaveContentDto, @CurrentUsername() user: string) {
    return this.svc.saveContent(id, dto, user);
  }
  @Post(':id/finalize') @HttpCode(200)
  finalize(@Param('id') id: string, @Body() dto: FinalizeDocumentDto, @CurrentUsername() user: string) {
    return this.svc.finalize(id, dto, user);
  }
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Body() dto: DuplicateDocumentDto, @CurrentUsername() user: string) {
    return this.svc.duplicate(id, dto, user);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUsername() user: string) { return this.svc.remove(id, user); }
}
