import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from '../assessment/entities';
import { SheetsController } from './sheets.controller';
import { SheetsScheduler } from './sheets.scheduler';
import { SheetsService } from './sheets.service';
import { DriveService } from './drive.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Level,
      Design,
      Competency,
      Simulation,
      AssessmentDesign,
      AssessmentDesignDetailCompetency,
      AssessmentDesignDetailSimulation,
    ]),
  ],
  controllers: [SheetsController],
  providers: [SheetsService, DriveService, SheetsScheduler],
  exports: [SheetsService, DriveService],
})
export class SheetsModule {}
