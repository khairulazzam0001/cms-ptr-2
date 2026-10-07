import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

// ============ master_level ============
@Entity('master_level')
export class Level {
  @PrimaryColumn({ length: 50 })
  level_id: string;

  @Column({ length: 100 })
  level_name: string;

  @Column({ type: 'text', nullable: true })
  level_desc?: string;

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

// ============ master_design ============
@Entity('master_design')
export class Design {
  @PrimaryColumn({ length: 50 })
  design_id: string;

  @Column({ length: 100 })
  design_name: string;

  @Column({ type: 'text', nullable: true })
  design_desc?: string;

  @Column({ type: 'text', nullable: true })
  design_background?: string;

  @Column({ type: 'text', nullable: true })
  design_background_md?: string;

  @Column({ type: 'text', nullable: true })
  instruction?: string;

  @Column({ type: 'text', nullable: true })
  instruction_md?: string;

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

// ============ master_competency ============
@Entity('master_competency')
export class Competency {
  @PrimaryColumn({ length: 50 })
  competency_id: string;

  @Column({ length: 150 })
  competency_name: string;

  @Column({ length: 50, nullable: true })
  group_competency_id?: string;

  @Column({ type: 'text', nullable: true })
  competency_desc?: string;

  @Column({ length: 50, nullable: true })
  level_id?: string;

  @ManyToOne(() => Level, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  level?: Level;

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

// ============ master_simulation (sesuai ERD user + tambahan level_id) ============
// kolom: simulation_id, simulation_name, simulation_desc, duration,
//        channel_name, group_simulation_id, level_id (FK master_level), status
@Entity('master_simulation')
export class Simulation {
  @PrimaryColumn({ length: 50 })
  simulation_id: string;

  @Column({ length: 150 })
  simulation_name: string;

  @Column({ type: 'text', nullable: true })
  simulation_desc?: string;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({ length: 100, nullable: true })
  channel_name?: string;

  @Column({ length: 50, nullable: true })
  group_simulation_id?: string;

  @Column({ length: 50, nullable: true })
  level_id?: string;

  @ManyToOne(() => Level, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_id' })
  level?: Level;

  @Column({ type: 'int', default: 1 })
  status: number;

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

// ============ master_assessment_design ============
@Entity('master_assessment_design')
export class AssessmentDesign {
  @PrimaryColumn({ length: 50 })
  assessment_design_id: string;

  @Column({ length: 150 })
  assessment_design_name: string;

  @Column({ type: 'text', nullable: true })
  assessment_design_desc?: string;

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

  @Column({ type: 'int', nullable: true })
  time_reminder?: number;

  @Column({ type: 'int', nullable: true })
  range_per_simulation?: number;

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

// ============ master_assessment_design_detail_competency ============
@Entity('master_assessment_design_detail_competency')
export class AssessmentDesignDetailCompetency {
  @PrimaryColumn({ length: 50 })
  assessment_design_detail_competency_id: string;

  @Column({ length: 50 })
  assessment_design_id: string;

  @ManyToOne(() => AssessmentDesign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_design_id' })
  assessmentDesign?: AssessmentDesign;

  @Column({ length: 50 })
  competency_id: string;

  @ManyToOne(() => Competency, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competency_id' })
  competency?: Competency;

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

// ============ master_assessment_design_detail_simulation ============
@Entity('master_assessment_design_detail_simulation')
export class AssessmentDesignDetailSimulation {
  @PrimaryColumn({ length: 50 })
  assessment_design_detail_simulation_id: string;

  @Column({ length: 50 })
  assessment_design_id: string;

  @ManyToOne(() => AssessmentDesign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_design_id' })
  assessmentDesign?: AssessmentDesign;

  @Column({ length: 50 })
  simulation_id: string;

  @ManyToOne(() => Simulation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'simulation_id' })
  simulation?: Simulation;

  @Column({ type: 'int', default: 0 })
  sequence: number;

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
