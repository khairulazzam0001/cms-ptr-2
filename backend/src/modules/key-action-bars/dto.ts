import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { FILE_FORMATS, FileFormat } from './bars-format';

// Parameter wajib dideklarasikan; ValidationPipe(whitelist) membuang yang tidak terdaftar.
export class BarsSimulationDto {
  @IsString() @IsNotEmpty() @MaxLength(50) simulation_id: string;
}

export class BarsTemplateQueryDto {
  @IsOptional() @IsString() @MaxLength(50) simulation_id?: string;
  // Format file unduhan; kosong = matrix
  @IsOptional() @IsIn(FILE_FORMATS) format?: FileFormat;
}

export class BarsExportQueryDto extends BarsSimulationDto {
  @IsOptional() @IsIn(FILE_FORMATS) format?: FileFormat;
}
