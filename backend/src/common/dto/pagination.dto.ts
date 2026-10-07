import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 10;

  @IsOptional() @IsString()
  search?: string = '';

  @IsOptional() @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional() @IsString()
  sortDir?: 'ASC' | 'DESC' = 'DESC';
}

export function paginateResponse<T>(data: T[], total: number, page: number, limit: number) {
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
