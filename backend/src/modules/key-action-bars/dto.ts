import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Parameter wajib dideklarasikan; ValidationPipe(whitelist) membuang yang tidak terdaftar.
export class BarsSimulationDto {
  @IsString() @IsNotEmpty() @MaxLength(50) simulation_id: string;
}

export class BarsTemplateQueryDto {
  @IsOptional() @IsString() @MaxLength(50) simulation_id?: string;
}
