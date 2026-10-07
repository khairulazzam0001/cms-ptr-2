import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { PaginationDto, paginateResponse } from '../../../common/dto/pagination.dto';
import { CreateExampleMasterDto } from './example-master.dto';
import { ExampleMaster } from './example-master.entity';

@Injectable()
export class ExampleMasterService {
  constructor(@InjectRepository(ExampleMaster) private repo: Repository<ExampleMaster>) {}

  findAll(q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const where = q.search ? [{ nama: Like(`%${q.search}%`) }, { kode: Like(`%${q.search}%`) }] : {};
    return this.repo.findAndCount({
      where, skip: (page - 1) * limit, take: limit,
      order: { [q.sortBy ?? 'createdAt']: (q.sortDir ?? 'DESC') as any },
    }).then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  findOne(id: number) { return this.repo.findOneOrFail({ where: { id } }); }
  create(dto: CreateExampleMasterDto) { return this.repo.save(this.repo.create(dto)); }
  async update(id: number, dto: Partial<CreateExampleMasterDto>) {
    await this.repo.update(id, dto as any); return this.findOne(id);
  }
  async remove(id: number) { await this.repo.delete(id); return { ok: true }; }
}
