import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AssessmentService } from './assessment.service';
import {
  AddCompetencyToDesignDto,
  AddSimulationToDesignDto,
  CreateAssessmentDesignDto,
  CreateCompetencyDto,
  CreateDesignDto,
  CreateLevelDto,
  CreateSimulationDto,
  CompetencyQueryDto,
  SimulationQueryDto,
  UpdateAssessmentDesignDto,
  UpdateCompetencyDto,
  UpdateDesignDto,
  UpdateLevelDto,
  UpdateSimulationDto,
} from './dto';

@Controller('levels')
export class LevelsController {
  constructor(private svc: AssessmentService) {}
  @Get() list(@Query() q: PaginationDto) { return this.svc.levelList(q); }
  @Get('options/all') options() { return this.svc.levelOptions(); }
  @Post() create(@Body() dto: CreateLevelDto) { return this.svc.levelCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateLevelDto) { return this.svc.levelUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.levelRemove(id); }
}

@Controller('designs')
export class DesignsController {
  constructor(private svc: AssessmentService) {}
  @Get() list(@Query() q: PaginationDto) { return this.svc.designList(q); }
  @Get('options/all') options() { return this.svc.designOptions(); }
  @Post() create(@Body() dto: CreateDesignDto) { return this.svc.designCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDesignDto) { return this.svc.designUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.designRemove(id); }
}

@Controller('competencies')
export class CompetenciesController {
  constructor(private svc: AssessmentService) {}
  @Get() list(@Query() q: CompetencyQueryDto) { return this.svc.competencyList(q); }
  @Post() create(@Body() dto: CreateCompetencyDto) { return this.svc.competencyCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCompetencyDto) { return this.svc.competencyUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.competencyRemove(id); }
}

@Controller('simulations')
export class SimulationsController {
  constructor(private svc: AssessmentService) {}
  @Get() list(@Query() q: SimulationQueryDto) { return this.svc.simulationList(q); }
  @Get('groups/all') groups() { return this.svc.simulationGroups(); }
  @Post() create(@Body() dto: CreateSimulationDto) { return this.svc.simulationCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateSimulationDto) { return this.svc.simulationUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.simulationRemove(id); }
}

@Controller('assessment-designs')
export class AssessmentDesignsController {
  constructor(private svc: AssessmentService) {}
  @Get() list(@Query() q: PaginationDto) { return this.svc.adesignList(q); }
  @Get(':id') one(@Param('id') id: string) { return this.svc.adesignOne(id); }
  @Post() create(@Body() dto: CreateAssessmentDesignDto) { return this.svc.adesignCreate(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAssessmentDesignDto) { return this.svc.adesignUpdate(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.adesignRemove(id); }

  // competency detail (View Competency + Add picker + Delete)
  @Get(':id/competencies') compList(@Param('id') id: string, @Query() q: PaginationDto) {
    return this.svc.detailCompList(id, q);
  }
  @Get(':id/competencies-available') compAvail(@Param('id') id: string, @Query() q: PaginationDto) {
    return this.svc.competencyAvailable(id, q);
  }
  @Post(':id/competencies') compAdd(@Param('id') id: string, @Body() dto: AddCompetencyToDesignDto) {
    return this.svc.detailCompAdd(id, dto);
  }
  @Delete(':id/competencies/:detailId') compRemove(@Param('id') id: string, @Param('detailId') d: string) {
    return this.svc.detailCompRemove(id, d);
  }

  // simulation detail (View Simulation + Add picker + Delete + Detail)
  @Get(':id/simulations') simList(@Param('id') id: string, @Query() q: PaginationDto) {
    return this.svc.detailSimList(id, q);
  }
  @Get(':id/simulations-available') simAvail(@Param('id') id: string, @Query() q: SimulationQueryDto) {
    return this.svc.simulationAvailable(id, q);
  }
  @Post(':id/simulations') simAdd(@Param('id') id: string, @Body() dto: AddSimulationToDesignDto) {
    return this.svc.detailSimAdd(id, dto);
  }
  @Delete(':id/simulations/:detailId') simRemove(@Param('id') id: string, @Param('detailId') d: string) {
    return this.svc.detailSimRemove(id, d);
  }
}
