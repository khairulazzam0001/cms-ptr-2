import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExampleMasterController } from './example-master.controller';
import { ExampleMaster } from './example-master.entity';
import { ExampleMasterService } from './example-master.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExampleMaster])],
  controllers: [ExampleMasterController],
  providers: [ExampleMasterService],
})
export class ExampleMasterModule {}
