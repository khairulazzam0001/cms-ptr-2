import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExampleMasterDto {
  @IsString() @MaxLength(100)
  nama: string;

  @IsOptional() @IsString() @MaxLength(50)
  kode?: string;

  @IsOptional() @IsString()
  dokumenUrl?: string;

  @IsOptional() @IsString()
  keterangan?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateExampleMasterDto extends CreateExampleMasterDto {}
