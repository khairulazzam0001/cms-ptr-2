import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ActivitiesController,
  ActivityTypesController,
  ActorsController,
  ChatsController,
  EmailsController,
  LanguagesController,
  PromptsController,
  ScenarioActivitiesController,
} from './assessment-data.controllers';
import { AssessmentDataService } from './assessment-data.service';
import { MasterDocument, MasterDocumentContent } from '../documents/document.entity';
import {
  Activity,
  ActivityType,
  Actor,
  BatchProject,
  Call,
  Chat,
  Email,
  EmailAttachment,
  Folder,
  GroupRating,
  KeyAction,
  Language,
  MappingGroupRating,
  Participant,
  ParticipantAssessor,
  Prompt,
  ScenarioActivity,
} from './entities';

/**
 * Modul tabel pelengkap ERD assessment (lihat entities.ts).
 *
 * CRUD yang sudah ada: master_activity, master_scenario_activity, master_chat,
 * master_email (+ endpoint options untuk activity type / actor / prompt).
 * Tabel lain baru didaftarkan agar TypeORM `synchronize` (DEV) membuatnya.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      KeyAction,
      GroupRating,
      MappingGroupRating,
      BatchProject,
      Participant,
      ParticipantAssessor,
      Actor,
      ActivityType,
      Activity,
      Prompt,
      ScenarioActivity,
      Chat,
      Call,
      Folder,
      Email,
      EmailAttachment,
      Language,
      MasterDocument,
      MasterDocumentContent,
    ]),
  ],
  controllers: [
    ActivitiesController,
    ScenarioActivitiesController,
    ChatsController,
    EmailsController,
    ActivityTypesController,
    ActorsController,
    PromptsController,
    LanguagesController,
  ],
  providers: [AssessmentDataService],
  exports: [AssessmentDataService],
})
export class AssessmentDataModule {}
