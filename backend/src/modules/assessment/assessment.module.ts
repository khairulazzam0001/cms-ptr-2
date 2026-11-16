import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentService } from './assessment.service';
import {
  AssessmentDesignsController,
  CompetenciesController,
  DesignsController,
  LevelsController,
  SimulationsController,
} from './controllers';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from './entities';

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
  controllers: [
    LevelsController,
    DesignsController,
    CompetenciesController,
    SimulationsController,
    AssessmentDesignsController,
  ],
  providers: [AssessmentService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
