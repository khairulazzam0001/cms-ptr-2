import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { toBoolean } from '../documents/dto';

// Field form upload & edit header sama dengan dokumen editor (aturan document_id, nama, deskripsi)
export { CreateDocumentDto as CreateUploadDocumentDto, UpdateDocumentDto as UpdateUploadDocumentDto } from '../documents/dto';

// Filter wajib dideklarasikan; ValidationPipe(whitelist) membuang query param yang tidak terdaftar.
export class UploadDocumentQueryDto extends PaginationDto {
  @IsOptional() @Transform(toBoolean) @IsBoolean() is_active?: boolean;
}

export class TranslateUploadDocumentDto {
  @IsString() target_language: string;
  @IsOptional() @IsString() source_language?: string;
}
