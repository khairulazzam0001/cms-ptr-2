import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CreateExampleMasterDto, UpdateExampleMasterDto } from './example-master.dto';
import { ExampleMasterService } from './example-master.service';

// CRUD + Search + Paging template. Route: /api/example-masters
@Controller('example-masters')
export class ExampleMasterController {
  constructor(private svc: ExampleMasterService) {}

  @Get() findAll(@Query() q: PaginationDto) { return this.svc.findAll(q); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(+id); }
  @Post() create(@Body() dto: CreateExampleMasterDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateExampleMasterDto) { return this.svc.update(+id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(+id); }
}
