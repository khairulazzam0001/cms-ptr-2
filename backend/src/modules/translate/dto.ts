import { IsOptional, IsString } from 'class-validator';

export class TranslateDto {
  // Teks biasa (mis. subject email)
  @IsOptional() @IsString() subject?: string;
  // HTML utuh (mis. isi email/dokumen); hanya text node yang diterjemahkan
  @IsOptional() @IsString() html?: string;
  // Nama bahasa target dari master_language (mis. "English")
  @IsString() target_language: string;
  @IsOptional() @IsString() source_language?: string;
}
