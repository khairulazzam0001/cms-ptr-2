import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

// Catatan: semua query param filter WAJIB dideklarasikan di sini.
// ValidationPipe(whitelist: true) membuang param yang tidak terdaftar.

// ================= MASTER ACTIVITY =================
export class ActivityQueryDto extends PaginationDto {
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() simulation_id?: string;
  @IsOptional() @IsString() ref_activity_type_id?: string;
}

export class CreateActivityDto {
  @IsString() @MaxLength(50) activity_id: string;
  @IsString() @MaxLength(255) activity_name: string;
  @IsOptional() @IsString() activity_desc?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() simulation_id?: string;
  @IsOptional() @IsString() ref_activity_type_id?: string;
  @IsOptional() @IsString() state_name?: string;
  @IsOptional() @IsBoolean() is_first?: boolean;
}

export class UpdateActivityDto {
  @IsOptional() @IsString() @MaxLength(255) activity_name?: string;
  @IsOptional() @IsString() activity_desc?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() simulation_id?: string;
  @IsOptional() @IsString() ref_activity_type_id?: string;
  @IsOptional() @IsString() state_name?: string;
  @IsOptional() @IsBoolean() is_first?: boolean;
}

// ================= MASTER SCENARIO ACTIVITY =================
export class ScenarioActivityQueryDto extends PaginationDto {
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() actor_id?: string;
}

export class CreateScenarioActivityDto {
  @IsString() @MaxLength(50) scenario_activity_id: string;
  @IsString() activity_id: string;
  @IsOptional() @IsString() triggered_activity_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) timer?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() actor_id?: string;
  @IsOptional() @IsString() prompt_id?: string;
  @IsOptional() @IsString() target_actor_id?: string;
  @IsOptional() @IsString() need_reply?: string;
  @IsOptional() @IsString() document_id?: string;
  @IsOptional() @IsString() target_activity_type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) trigger_timer?: number;
}

export class UpdateScenarioActivityDto {
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() triggered_activity_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) timer?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() actor_id?: string;
  @IsOptional() @IsString() prompt_id?: string;
  @IsOptional() @IsString() target_actor_id?: string;
  @IsOptional() @IsString() need_reply?: string;
  @IsOptional() @IsString() document_id?: string;
  @IsOptional() @IsString() target_activity_type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) trigger_timer?: number;
}

// ================= MASTER CHAT =================
export class ChatQueryDto extends PaginationDto {
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() actor_id?: string;
}

export class CreateChatDto {
  @IsString() @MaxLength(50) chat_id: string;
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() @MaxLength(255) chat_name?: string;
  @IsOptional() @IsString() actor_id?: string;
  @IsOptional() @IsString() content?: string;
}

export class UpdateChatDto {
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() @MaxLength(255) chat_name?: string;
  @IsOptional() @IsString() actor_id?: string;
  @IsOptional() @IsString() content?: string;
}

// ================= MASTER EMAIL =================
export class EmailQueryDto extends PaginationDto {
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() email_type?: string;
}

export class CreateEmailDto {
  @IsString() @MaxLength(50) email_id: string;
  @IsOptional() @IsString() email_name?: string;
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() parent_activity_id?: string;
  @IsOptional() @IsString() actor_from?: string;
  @IsOptional() @IsString() actor_to?: string;
  @IsOptional() @IsString() actor_cc?: string;
  @IsOptional() @IsString() @MaxLength(255) email_type?: string;
  @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @IsOptional() @IsString() content?: string;
}

export class UpdateEmailDto {
  @IsOptional() @IsString() email_name?: string;
  @IsOptional() @IsString() activity_id?: string;
  @IsOptional() @IsString() parent_activity_id?: string;
  @IsOptional() @IsString() actor_from?: string;
  @IsOptional() @IsString() actor_to?: string;
  @IsOptional() @IsString() actor_cc?: string;
  @IsOptional() @IsString() @MaxLength(255) email_type?: string;
  @IsOptional() @IsString() @MaxLength(255) subject?: string;
  @IsOptional() @IsString() content?: string;
}

// Lampiran email: cukup pilih dokumen (doc_content_id di-resolve ke halaman pertama).
export class CreateEmailAttachmentDto {
  @IsOptional() @IsString() @MaxLength(50) attachment_id?: string;
  @IsOptional() @IsString() document_id?: string;
  @IsOptional() @IsString() doc_content_id?: string;
}

// ================= MASTER ACTOR =================
export class ActorQueryDto extends PaginationDto {
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() level_id?: string;
}

export class CreateActorDto {
  @IsString() @MaxLength(50) actor_id: string;
  @IsString() @MaxLength(255) actor_name: string;
  @IsOptional() @IsString() @MaxLength(255) actor_email?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_position?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_division?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_group_position?: string;
  @IsOptional() @IsString() superior?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() persona_desc?: string;
  @IsOptional() @IsBoolean() is_participant?: boolean;
}

export class UpdateActorDto {
  @IsOptional() @IsString() @MaxLength(255) actor_name?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_email?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_position?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_division?: string;
  @IsOptional() @IsString() @MaxLength(255) actor_group_position?: string;
  @IsOptional() @IsString() superior?: string;
  @IsOptional() @IsString() design_id?: string;
  @IsOptional() @IsString() level_id?: string;
  @IsOptional() @IsString() persona_desc?: string;
  @IsOptional() @IsBoolean() is_participant?: boolean;
}
