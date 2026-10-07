import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DOCUMENT_STATUSES, DocumentStatus } from './document.entity';

export const MAX_PAGES = 200;
export const MAX_PAGE_BYTES = 512 * 1024;

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ID_MESSAGE = 'document_id hanya boleh huruf, angka, "-" dan "_"';

// Query string 'true'/'false' -> boolean (nilai lain dibiarkan agar ditolak @IsBoolean)
export const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;

// ---- Query (list + filter) ----
// Filter wajib dideklarasikan di sini; ValidationPipe(whitelist) membuang query param yang tidak terdaftar.
export class DocumentQueryDto extends PaginationDto {
  @IsOptional() @IsIn(DOCUMENT_STATUSES) status?: DocumentStatus;
  @IsOptional() @Transform(toBoolean) @IsBoolean() is_active?: boolean;
}

// ---- Header ----
export class CreateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(ID_PATTERN, { message: ID_MESSAGE })
  document_id: string;

  @IsString() @IsNotEmpty() @MaxLength(150)
  document_name: string;

  @IsOptional() @IsString()
  document_desc?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) document_name?: string;
  @IsOptional() @IsString() document_desc?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

// ---- Konten ----
export class DocumentPageDto {
  @IsInt() @Min(1) page: number;
  @IsString() content_html: string;
}

// Teks polos (dirender sebagai teks, bukan HTML); token {page} dan {pages}
export class HeaderFooterDto {
  @IsOptional() @IsString() @MaxLength(200) header_left?: string;
  @IsOptional() @IsString() @MaxLength(200) header_center?: string;
  @IsOptional() @IsString() @MaxLength(200) header_right?: string;
  @IsOptional() @IsString() @MaxLength(200) footer_left?: string;
  @IsOptional() @IsString() @MaxLength(200) footer_center?: string;
  @IsOptional() @IsString() @MaxLength(200) footer_right?: string;
  @IsOptional() @IsBoolean() hide_header_footer_first_page?: boolean;
}

export class SaveContentDto {
  @IsInt() @Min(0) revision: number;

  // Header/footer ikut disimpan bersama konten (di bawah revision yang sama; FINAL -> DRAFT)
  @IsOptional() @ValidateNested() @Type(() => HeaderFooterDto)
  header_footer?: HeaderFooterDto;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_PAGES)
  @ValidateNested({ each: true }) @Type(() => DocumentPageDto)
  pages: DocumentPageDto[];
}

export class FinalizeDocumentDto {
  @IsInt() @Min(0) revision: number;
}

export class DuplicateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(ID_PATTERN, { message: ID_MESSAGE })
  document_id: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  document_name?: string;
}
