import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ---- Query (list + filter) ----
// Field filter wajib dideklarasikan di DTO; ValidationPipe(whitelist) membuang query param yang tidak terdaftar.
export class CompetencyQueryDto extends PaginationDto {
  @IsOptional() @IsString() level_id?: string;
}
export class SimulationQueryDto extends PaginationDto {
  @IsOptional() @IsString() group_simulation_id?: string;
  @IsOptional() @IsString() group_simulation?: string; // alias lama
  @IsOptional() @IsString() level_id?: string;
}

// ---- Level ----
export class CreateLevelDto {
  @IsString() @MaxLength(50) level_id: string;
  @IsString() @MaxLength(100) level_name: string;
  @IsOptional() @IsString() level_desc?: string;
}
export class UpdateLevelDto {
  @IsOptional() @IsString() @MaxLength(100) level_name?: string;
  @IsOptional() @IsString() level_desc?: string;
}

// ---- Design ----
export class CreateDesignDto {
  @IsString() @MaxLength(50) design_id: string;
  @IsString() @MaxLength(100) design_name: string;
  @IsOptional() @IsString() design_desc?: string;
  @IsOptional() @IsString() design_background?: string;
  @IsOptional() @IsString() design_background_md?: string;
  @IsOptional() @IsString() instruction?: string;
  @IsOptional() @IsString() instruction_md?: string;
}
export class UpdateDesignDto {
  @IsOptional() @IsString() design_name?: string;
  @IsOptional() @IsString() design_desc?: string;
  @IsOptional() @IsString() design_background?: string;
  @IsOptional() @IsString() design_background_md?: string;
  @IsOptional() @IsString() instruction?: string;
  @IsOptional() @IsString() instruction_md?: string;
}

// ---- Competency ----
export class CreateCompetencyDto {
  @IsString() @MaxLength(50) competency_id: string;
  @IsString() @MaxLength(150) competency_name: string;
  @IsOptional() @IsString() group_competency_id?: string;
  @IsOptional() @IsString() competency_desc?: string;
  @IsOptional() @IsString() level_id?: string;
}
export class UpdateCompetencyDto {
  @IsOptional() @IsString() competency_name?: string;
  @IsOptional() @IsString() group_competency_id?: string;
  @IsOptional() @IsString() competency_desc?: string;
  @IsOptional() @IsString() level_id?: string;
}

// ---- Simulation (sesuai ERD master_simulation + level_id) ----
export class CreateSimulationDto {
  @IsString() @MaxLength(50) simulation_id: string;
  @IsString() @MaxLength(150) simulation_name: string;
  @IsOptional() @IsString() simulation_desc?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsString() channel_name?: string;
  @IsOptional() @IsString() group_simulation_id?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() status?: number;
}
export class UpdateSimulationDto {
  @IsOptional() @IsString() simulation_name?: string;
  @IsOptional() @IsString() simulation_desc?: string;
  @IsOptional() @Type(() => Number) @IsInt() duration?: number;
  @IsOptional() @IsString() channel_name?: string;
  @IsOptional() @IsString() group_simulation_id?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() status?: number;
}

// ---- AssessmentDesign (sesuai Lofi: id, Name, Level dropdown, Design dropdown) ----
export class CreateAssessmentDesignDto {
  @IsString() @MaxLength(50) assessment_design_id: string;
  @IsString() @MaxLength(150) assessment_design_name: string;
  @IsOptional() @IsString() assessment_design_desc?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() time_reminder?: number;
  @IsOptional() @Type(() => Number) @IsInt() range_per_simulation?: number;
}
export class UpdateAssessmentDesignDto {
  @IsOptional() @IsString() assessment_design_name?: string;
  @IsOptional() @IsString() assessment_design_desc?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() time_reminder?: number;
  @IsOptional() @Type(() => Number) @IsInt() range_per_simulation?: number;
}

// ---- Detail add ----
export class AddCompetencyToDesignDto {
  @IsString() competency_id: string;
}
export class AddSimulationToDesignDto {
  @IsString() simulation_id: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sequence?: number;
}
