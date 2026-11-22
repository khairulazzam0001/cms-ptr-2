import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Simulation } from '../assessment/entities';
import { KeyAction, KeyActionBars, KeyActionBarsBehaviour } from '../assessment-data/entities';
import { KeyActionBarsController } from './key-action-bars.controller';
import { KeyActionBarsService } from './key-action-bars.service';

@Module({
  imports: [TypeOrmModule.forFeature([Simulation, KeyAction, KeyActionBars, KeyActionBarsBehaviour])],
  controllers: [KeyActionBarsController],
  providers: [KeyActionBarsService],
})
export class KeyActionBarsModule {}
