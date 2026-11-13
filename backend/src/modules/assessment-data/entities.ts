import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AssessmentDesign,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from '../assessment/entities';
import { MasterDocument } from '../documents/document.entity';

/**
 * Tabel pelengkap ERD "assessment-ano"
 * (https://dbdiagram.io/d/assessment-ano-6ad87bc7f8963ca19c6f79e6).
 *
 * Tabel yang SUDAH ada di modul lain dan tidak diduplikasi di sini:
 *  - master_level, master_design, master_competency, master_simulation
 *  - master_assessment_design, master_assessment_design_detail_competency,
 *    master_assessment_design_detail_simulation      -> modul assessment
 *  - master_document, master_document_content        -> modul documents
 *
 * Konvensi sama dengan tabel master lain: PK string manual, kolom audit,
 * soft delete via is_deleted. Panjang kolom *_id = 50 agar cocok dengan
 * kolom yang direferensikan (MySQL mewajibkan tipe FK identik).
 */
abstract class AuditColumns {
  @Column({ nullable: true })
  created_by?: string;

  @CreateDateColumn()
  created_date: Date;

  @Column({ nullable: true })
  modified_by?: string;

  @UpdateDateColumn()
  modified_date: Date;

  @Column({ default: false })
  is_deleted: boolean;
}

// ============ master_key_action ============
@Entity('master_key_action')
export class KeyAction extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  key_action_id: string;

  @Column({ length: 100, nullable: true })
  key_action_code?: string;

  @Column({ length: 255 })
  key_action_name: string;

  @Column({ type: 'longtext', nullable: true })
  key_action_desc?: string;

  @Column({ length: 50, nullable: true })
  competency_id?: string;

  @ManyToOne(() => Competency, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'competency_id' })
  competency?: Competency;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}

// ============ ref_group_rating ============
@Entity('ref_group_rating')
export class GroupRating extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  group_rating_id: string;

  @Column({ length: 255 })
  group_rating_name: string;
}

// ============ ref_mapping_group_rating ============
@Entity('ref_mapping_group_rating')
export class MappingGroupRating extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  mapping_group_rating_id: string;

  @Column({ length: 50, nullable: true })
  group_rating_id?: string;

  @ManyToOne(() => GroupRating, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_rating_id' })
  groupRating?: GroupRating;

  @Column({ length: 50, nullable: true })
  assessment_design_detail_simulation_id?: string;

  @ManyToOne(() => AssessmentDesignDetailSimulation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assessment_design_detail_simulation_id' })
  detailSimulation?: AssessmentDesignDetailSimulation;
}

// ============ trans_batch_project ============
@Entity('trans_batch_project')
export class BatchProject extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  batch_id: string;

  // FK ke master_company (tabel belum ada di ERD)
  @Column({ length: 50 })
  company_id: string;

  // FK ke master_email_template (tabel belum ada di ERD)
  @Column({ length: 50 })
  email_template_id: string;

  @Column({ length: 50 })
  assessment_design_id: string;

  @ManyToOne(() => AssessmentDesign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_design_id' })
  assessmentDesign?: AssessmentDesign;

  @Column({ length: 255, nullable: true })
  batch_name?: string;

  @Column({ type: 'datetime', nullable: true })
  batch_start_date?: Date;

  @Column({ type: 'datetime', nullable: true })
  batch_end_date?: Date;

  @Column({ type: 'datetime', nullable: true })
  due_date_rating?: Date;

  // ERD menulis "smalint" (typo smallint) — dipakai sebagai flag 0/1
  @Column({ type: 'int', default: 0 })
  allow_proctoring: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // FK ke master_position (tabel belum ada di ERD)
  @Column({ length: 50, nullable: true })
  position_id?: string;
}

// ============ trans_participant ============
@Entity('trans_participant')
export class Participant extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  participant_id: string;

  @Column({ length: 50, nullable: true })
  batch_id?: string;

  @ManyToOne(() => BatchProject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'batch_id' })
  batch?: BatchProject;

  @Column({ type: 'datetime', nullable: true })
  nda_agree_time?: Date;

  @Column({ type: 'int', default: 0 })
  invitation_sent: number;

  @Column({ type: 'datetime', nullable: true })
  invitation_sent_time?: Date;

  @Column({ length: 255, nullable: true })
  status?: string;
}

// ============ trans_participant_assessor ============
@Entity('trans_participant_assessor')
export class ParticipantAssessor extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  participant_assessor_id: string;

  @Column({ length: 50, nullable: true })
  participant_id?: string;

  @ManyToOne(() => Participant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant?: Participant;

  @Column({ length: 50, nullable: true })
  group_rating_id?: string;

  @ManyToOne(() => GroupRating, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_rating_id' })
  groupRating?: GroupRating;

  // diisi users.user_id
  @Column({ length: 50, nullable: true })
  assessor_id?: string;

  @Column({ length: 50, nullable: true })
  batch_id?: string;

  @ManyToOne(() => BatchProject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'batch_id' })
  batch?: BatchProject;

  @Column({ length: 255, nullable: true })
  status?: string;

  @Column({ type: 'timestamp', nullable: true })
  start_rating_date?: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_rating_date?: Date;
}

// ============ master_actor ============
@Entity('master_actor')
export class Actor extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  actor_id: string;

  @Column({ length: 255 })
  actor_name: string;

  @Column({ length: 255, nullable: true })
  actor_email?: string;

  @Column({ length: 255, nullable: true })
  actor_position?: string;

  @Column({ length: 255, nullable: true })
  actor_division?: string;

  @Column({ length: 255, nullable: true })
  actor_group_position?: string;

  // atasan langsung (self reference ke master_actor.actor_id)
  @Column({ length: 50, nullable: true })
  superior?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'superior' })
  superiorActor?: Actor;

  @Column({ length: 50, nullable: true })
  design_id?: string;

  @ManyToOne(() => Design, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'design_id' })
  design?: Design;

  @Column({ length: 50, nullable: true })
  level_id?: string;

  @ManyToOne(() => Level, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  level?: Level;

  @Column({ type: 'longtext', nullable: true })
  persona_desc?: string;

  @Column({ default: false })
  is_participant: boolean;
}

// ============ ref_activity_type (CHAT, EMAIL, HOME, DOCUMENT) ============
@Entity('ref_activity_type')
export class ActivityType extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  ref_activity_type_id: string;

  @Column({ length: 255 })
  ref_activity_type_name: string;

  @Column({ type: 'longtext', nullable: true })
  ref_activity_type_desc?: string;

  @Column({ length: 255, nullable: true })
  icon_name?: string;
}

// ============ master_activity ============
@Entity('master_activity')
export class Activity extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  activity_id: string;

  @Column({ length: 255 })
  activity_name: string;

  @Column({ type: 'longtext', nullable: true })
  activity_desc?: string;

  @Column({ length: 50, nullable: true })
  level_id?: string;

  @ManyToOne(() => Level, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  level?: Level;

  @Column({ length: 50, nullable: true })
  design_id?: string;

  @ManyToOne(() => Design, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'design_id' })
  design?: Design;

  @Column({ length: 50, nullable: true })
  simulation_id?: string;

  @ManyToOne(() => Simulation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'simulation_id' })
  simulation?: Simulation;

  @Column({ length: 50, nullable: true })
  ref_activity_type_id?: string;

  @ManyToOne(() => ActivityType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ref_activity_type_id' })
  activityType?: ActivityType;

  @Column({ length: 255, nullable: true })
  state_name?: string;

  @Column({ default: false })
  is_first: boolean;
}

// ============ master_prompt ============
@Entity('master_prompt')
export class Prompt extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  prompt_id: string;

  @Column({ length: 50, nullable: true })
  activity_type_id?: string;

  @Column({ length: 50, nullable: true })
  simulation_id?: string;

  @Column({ type: 'longtext', nullable: true })
  content?: string;

  // nama kolom di ERD: "desc" (kata kunci MySQL -> di-escape TypeORM)
  @Column({ name: 'desc', type: 'longtext', nullable: true })
  prompt_desc?: string;
}

// ============ master_scenario_activity ============
@Entity('master_scenario_activity')
export class ScenarioActivity extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  scenario_activity_id: string;

  @Column({ length: 50 })
  activity_id: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity?: Activity;

  @Column({ length: 50, nullable: true })
  triggered_activity_id?: string;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'triggered_activity_id' })
  triggeredActivity?: Activity;

  @Column({ type: 'int', nullable: true })
  timer?: number;

  // UNEXPECTED, SOLUTION
  @Column({ length: 255, nullable: true })
  status?: string;

  @Column({ length: 50, nullable: true })
  actor_id?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: Actor;

  @Column({ length: 50, nullable: true })
  prompt_id?: string;

  @ManyToOne(() => Prompt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prompt_id' })
  prompt?: Prompt;

  @Column({ length: 50, nullable: true })
  target_actor_id?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_actor_id' })
  targetActor?: Actor;

  @Column({ length: 255, nullable: true })
  need_reply?: string;

  // master_document.document_id (dokumen lampiran skenario)
  @Column({ length: 50, nullable: true })
  document_id?: string;

  @ManyToOne(() => MasterDocument, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_id' })
  document?: MasterDocument;

  @Column({ length: 50, nullable: true })
  target_activity_type?: string;

  @ManyToOne(() => ActivityType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_activity_type' })
  targetActivityType?: ActivityType;

  @Column({ type: 'int', nullable: true })
  trigger_timer?: number;
}

// ============ master_chat ============
@Entity('master_chat')
export class Chat extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  chat_id: string;

  @Column({ length: 50, nullable: true })
  activity_id?: string;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity?: Activity;

  @Column({ length: 255, nullable: true })
  chat_name?: string;

  @Column({ length: 50, nullable: true })
  actor_id?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: Actor;

  @Column({ type: 'longtext', nullable: true })
  content?: string;
}

// ============ master_call ============
@Entity('master_call')
export class Call extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  call_id: string;

  @Column({ length: 50, nullable: true })
  activity_id?: string;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity?: Activity;

  @Column({ length: 255, nullable: true })
  call_name?: string;

  @Column({ length: 50, nullable: true })
  actor_id?: string;

  @Column({ type: 'longtext', nullable: true })
  content?: string;
}

// ============ master_folder ============
@Entity('master_folder')
export class Folder extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  folder_id: string;

  @Column({ length: 255 })
  folder_name: string;

  @Column({ length: 50, nullable: true })
  assessment_design_id?: string;

  @ManyToOne(() => AssessmentDesign, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_design_id' })
  assessmentDesign?: AssessmentDesign;

  // master_actor.actor_id
  @Column({ length: 50, nullable: true })
  owner?: string;

  @Column({ length: 50, nullable: true })
  level_id?: string;

  @ManyToOne(() => Level, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  level?: Level;

  @Column({ length: 50, nullable: true })
  design_id?: string;

  @ManyToOne(() => Design, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'design_id' })
  design?: Design;

  @Column({ type: 'int', nullable: true, default: 0 })
  sort?: number;
}

// ============ master_email ============
@Entity('master_email')
export class Email extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  email_id: string;

  @Column({ type: 'longtext', nullable: true })
  email_name?: string;

  @Column({ length: 50, nullable: true })
  activity_id?: string;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity?: Activity;

  @Column({ length: 50, nullable: true })
  parent_activity_id?: string;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_activity_id' })
  parentActivity?: Activity;

  @Column({ length: 50, nullable: true })
  actor_from?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_from' })
  actorFrom?: Actor;

  @Column({ length: 50, nullable: true })
  actor_to?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_to' })
  actorTo?: Actor;

  @Column({ length: 50, nullable: true })
  actor_cc?: string;

  @ManyToOne(() => Actor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_cc' })
  actorCc?: Actor;

  @Column({ length: 255, nullable: true })
  email_type?: string;

  @Column({ length: 255, nullable: true })
  subject?: string;

  @Column({ type: 'longtext', nullable: true })
  content?: string;
}

// ============ master_email_attachment ============
@Entity('master_email_attachment')
export class EmailAttachment extends AuditColumns {
  @PrimaryColumn({ length: 50 })
  attachment_id: string;

  @Column({ length: 50 })
  email_id: string;

  @ManyToOne(() => Email, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'email_id' })
  email?: Email;

  // master_document_content.document_content_id (PK modul documents = uuid) — tanpa FK
  @Column({ length: 50, nullable: true })
  doc_content_id?: string;
}
