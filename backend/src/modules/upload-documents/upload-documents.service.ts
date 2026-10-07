import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { paginateResponse } from '../../common/dto/pagination.dto';
import { MasterDocument, MasterDocumentContent, READ_ONLY_DOCUMENT } from '../documents/document.entity';
import { CreateUploadDocumentDto, UpdateUploadDocumentDto, UploadDocumentQueryDto } from './dto';
import { UploadedHtml, htmlWarnings, readHtmlFile } from './html-file';

// Dokumen HTML upload (PRD_Upload_Document.md): header di master_document dengan read_only = 'document',
// isi utuh di master_document_content sebagai SATU baris page = 0.
const CONTENT_PAGE = 0;
const NOT_FOUND = 'Dokumen tidak ditemukan';
const ID_TAKEN = 'ID sudah dipakai';
const UPLOAD_DOC = { is_deleted: false, read_only: READ_ONLY_DOCUMENT };

const byteLength = (html: string) => Buffer.byteLength(html, 'utf8');

@Injectable()
export class UploadDocumentsService {
  constructor(
    @InjectRepository(MasterDocument) private docs: Repository<MasterDocument>,
    @InjectRepository(MasterDocumentContent) private contents: Repository<MasterDocumentContent>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async list(q: UploadDocumentQueryDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.docs
      .createQueryBuilder('d')
      .where('d.is_deleted = false')
      .andWhere('d.read_only = :ro', { ro: READ_ONLY_DOCUMENT });
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
    const [data, total] = await qb.getManyAndCount();

    // ukuran isi dalam satu query (tanpa memuat content_html, tanpa N+1)
    const sizes = new Map<string, number>();
    if (data.length) {
      const rows: { document_id: string; size_bytes: string | number }[] = await this.contents
        .createQueryBuilder('c')
        .select('c.document_id', 'document_id')
        .addSelect('OCTET_LENGTH(c.content_html)', 'size_bytes')
        .where({ document_id: In(data.map((d) => d.document_id)), page: CONTENT_PAGE, is_deleted: false })
        .getRawMany();
      rows.forEach((r) => sizes.set(r.document_id, Number(r.size_bytes)));
    }
    return paginateResponse(
      data.map((d) => ({ ...d, size_bytes: sizes.get(d.document_id) ?? 0 })),
      total,
      page,
      limit,
    );
  }

  async get(id: string) {
    const doc = await this.findActive(id);
    const html = await this.readContent(id);
    return { ...doc, size_bytes: byteLength(html), content_html: html };
  }

  async download(id: string) {
    await this.findActive(id);
    return { filename: `${id}.html`, html: await this.readContent(id) };
  }

  async create(dto: CreateUploadDocumentDto, file: UploadedHtml | undefined, username: string) {
    const html = readHtmlFile(file);
    // ID unik lintas dokumen editor & upload, termasuk yang sudah dihapus
    if (await this.docs.exists({ where: { document_id: dto.document_id } })) throw new ConflictException(ID_TAKEN);

    const saved = await this.dataSource.transaction(async (m) => {
      const doc = await m.save(
        m.create(MasterDocument, {
          document_id: dto.document_id,
          document_name: dto.document_name,
          document_desc: dto.document_desc,
          read_only: READ_ONLY_DOCUMENT,
          status: 'FINAL',
          page_count: 0,
          revision: 0,
          created_by: username,
          modified_by: username,
        }),
      );
      await m.insert(MasterDocumentContent, {
        document_id: dto.document_id,
        page: CONTENT_PAGE,
        content_html: html,
        created_by: username,
        modified_by: username,
      });
      return doc;
    });
    return { ...saved, size_bytes: byteLength(html), warnings: htmlWarnings(html) };
  }

  // Ganti isi file: tetap 1 baris page = 0, revision + 1, status tetap FINAL
  async replaceFile(id: string, file: UploadedHtml | undefined, username: string) {
    const html = readHtmlFile(file);
    const saved = await this.dataSource.transaction(async (m) => {
      const doc = await this.lockActive(m, id);
      const res = await m.update(
        MasterDocumentContent,
        { document_id: id, page: CONTENT_PAGE },
        { content_html: html, modified_by: username, is_deleted: false },
      );
      if (!res.affected) {
        await m.insert(MasterDocumentContent, {
          document_id: id,
          page: CONTENT_PAGE,
          content_html: html,
          created_by: username,
          modified_by: username,
        });
      }
      doc.revision += 1;
      doc.modified_by = username;
      return m.save(doc);
    });
    return { ...saved, size_bytes: byteLength(html), warnings: htmlWarnings(html) };
  }

  async update(id: string, dto: UpdateUploadDocumentDto, username: string) {
    const doc = await this.findActive(id);
    Object.assign(doc, dto, { modified_by: username });
    return this.docs.save(doc);
  }

  async remove(id: string, username: string) {
    const doc = await this.findActive(id);
    doc.is_deleted = true;
    doc.modified_by = username;
    await this.docs.save(doc);
    return { ok: true };
  }

  private async readContent(id: string) {
    const row = await this.contents.findOne({
      where: { document_id: id, page: CONTENT_PAGE, is_deleted: false },
      select: { content_html: true },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row.content_html;
  }

  private async findActive(id: string) {
    const doc = await this.docs.findOne({ where: { document_id: id, ...UPLOAD_DOC } });
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return doc;
  }

  private async lockActive(m: EntityManager, id: string) {
    const doc = await m.findOne(MasterDocument, {
      where: { document_id: id, ...UPLOAD_DOC },
      lock: { mode: 'pessimistic_write' },
    });
    if (!doc) throw new NotFoundException(NOT_FOUND);
    return doc;
  }
}
