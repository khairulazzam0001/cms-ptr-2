import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { paginateResponse } from '../../common/dto/pagination.dto';
import { HEADER_FOOTER_FIELDS, MasterDocument, MasterDocumentContent } from './document.entity';
import {
  CreateDocumentDto,
  DocumentQueryDto,
  DuplicateDocumentDto,
  FinalizeDocumentDto,
  MAX_PAGE_BYTES,
  SaveContentDto,
  UpdateDocumentDto,
} from './dto';
import { isEmptyDocumentHtml, sanitizeDocumentHtml } from './sanitize';

const NOT_FOUND = 'Dokumen tidak ditemukan';
const ID_TAKEN = 'ID sudah dipakai';
const REVISION_CONFLICT = 'Dokumen telah diubah di tab/sesi lain';

function pickHeaderFooter(d: MasterDocument) {
  return Object.fromEntries(HEADER_FOOTER_FIELDS.map((f) => [f, d[f]])) as Pick<MasterDocument, (typeof HEADER_FOOTER_FIELDS)[number]>;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(MasterDocument) private docs: Repository<MasterDocument>,
    @InjectRepository(MasterDocumentContent) private contents: Repository<MasterDocumentContent>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  list(q: DocumentQueryDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.docs.createQueryBuilder('d').where('d.is_deleted = false');
    if (q.status) qb.andWhere('d.status = :status', { status: q.status });
    if (q.is_active !== undefined) qb.andWhere('d.is_active = :active', { active: q.is_active });
    if (q.search) {
      qb.andWhere(
        new Brackets((sqb) => {
          ['document_id', 'document_name', 'document_desc'].forEach((c) =>
            sqb.orWhere(`d.${c} LIKE :s`, { s: `%${q.search}%` }),
          );
        }),
      );
    }
    qb.orderBy('d.modified_date', 'DESC').skip((page - 1) * limit).take(limit);
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }

  async get(id: string) {
    const doc = await this.findActive(id);
    const pages = await this.contents.find({
      where: { document_id: id, is_deleted: false },
      select: { page: true, content_html: true },
      order: { page: 'ASC' },
    });
    return { ...doc, pages };
  }

  async create(dto: CreateDocumentDto, username: string) {
    // ID unik termasuk dokumen yang sudah di-soft delete
    if (await this.docs.exists({ where: { document_id: dto.document_id } })) throw new ConflictException(ID_TAKEN);
    return this.docs.save(
      this.docs.create({ ...dto, status: 'DRAFT', page_count: 0, revision: 0, created_by: username, modified_by: username }),
    );
  }

  // Ubah nama/deskripsi/aktif tidak mengubah status (FR-13)
  async update(id: string, dto: UpdateDocumentDto, username: string) {
    const doc = await this.findActive(id);
    Object.assign(doc, dto, { modified_by: username });
    return this.docs.save(doc);
  }

  async saveContent(id: string, dto: SaveContentDto, username: string) {
    dto.pages.forEach((p, i) => {
      if (p.page !== i + 1) throw new BadRequestException('page harus berurutan 1..n tanpa duplikat atau celah');
      if (Buffer.byteLength(p.content_html, 'utf8') > MAX_PAGE_BYTES)
        throw new PayloadTooLargeException(`Halaman ${p.page} melebihi ${MAX_PAGE_BYTES / 1024} KB`);
    });
    const pages = dto.pages.map((p) => ({ page: p.page, content_html: sanitizeDocumentHtml(p.content_html) }));

    return this.dataSource.transaction(async (m) => {
      const doc = await this.lockActive(m, id);
      if (doc.revision !== dto.revision) throw new ConflictException(REVISION_CONFLICT);

      await m.delete(MasterDocumentContent, { document_id: id });
      await m.insert(
        MasterDocumentContent,
        pages.map((p) => ({ document_id: id, ...p, created_by: username, modified_by: username })),
      );

      const hf = dto.header_footer;
      if (hf) Object.assign(doc, Object.fromEntries(HEADER_FOOTER_FIELDS.filter((f) => hf[f] !== undefined).map((f) => [f, hf[f]])));
      doc.page_count = pages.length;
      doc.revision += 1;
      doc.status = 'DRAFT'; // perubahan konten mengembalikan FINAL -> DRAFT (FR-54)
      doc.modified_by = username;
      const saved = await m.save(doc);
      return {
        revision: saved.revision,
        status: saved.status,
        page_count: saved.page_count,
        modified_date: saved.modified_date,
        ...pickHeaderFooter(saved),
        pages,
      };
    });
  }

  async finalize(id: string, dto: FinalizeDocumentDto, username: string) {
    return this.dataSource.transaction(async (m) => {
      const doc = await this.lockActive(m, id);
      if (doc.revision !== dto.revision) throw new ConflictException(REVISION_CONFLICT);
      const pages = await m.find(MasterDocumentContent, { where: { document_id: id, is_deleted: false } });
      if (pages.every((p) => isEmptyDocumentHtml(p.content_html))) throw new BadRequestException('Dokumen masih kosong');
      doc.status = 'FINAL';
      doc.modified_by = username;
      return m.save(doc);
    });
  }

  async duplicate(id: string, dto: DuplicateDocumentDto, username: string) {
    const source = await this.findActive(id);
    if (await this.docs.exists({ where: { document_id: dto.document_id } })) throw new ConflictException(ID_TAKEN);
    const name = (dto.document_name || `Salinan dari ${source.document_name}`).slice(0, 150);

    return this.dataSource.transaction(async (m) => {
      const pages = await m.find(MasterDocumentContent, { where: { document_id: id, is_deleted: false }, order: { page: 'ASC' } });
      const copy = await m.save(
        m.create(MasterDocument, {
          document_id: dto.document_id,
          document_name: name,
          document_desc: source.document_desc,
          ...pickHeaderFooter(source),
          is_active: source.is_active,
          status: 'DRAFT',
          page_count: pages.length,
          revision: 0,
          created_by: username,
          modified_by: username,
        }),
      );
      if (pages.length) {
        await m.insert(
          MasterDocumentContent,
          pages.map((p) => ({
            document_id: dto.document_id,
            page: p.page,
            content_html: p.content_html,
            created_by: username,
            modified_by: username,
          })),
        );
      }
      return copy;
    });
  }

  async remove(id: string, username: string) {
    const doc = await this.findActive(id);
    doc.is_deleted = true;
    doc.modified_by = username;
    await this.docs.save(doc);
    return { ok: true };
  }

  private async findActive(id: string) {
    const doc = await this.docs.findOne({ where: { document_id: id, is_deleted: false } });
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return doc;
  }

  // SELECT ... FOR UPDATE: serialisasi simpan konten/finalize per dokumen
  private async lockActive(m: EntityManager, id: string) {
    const doc = await m.findOne(MasterDocument, {
      where: { document_id: id, is_deleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return doc;
  }
}
