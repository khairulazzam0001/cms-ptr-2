import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DocumentsService } from './documents.service';
import { MasterDocument, MasterDocumentContent } from './document.entity';
import { MAX_PAGE_BYTES } from './dto';

function makeDoc(over: Partial<MasterDocument> = {}): MasterDocument {
  return {
    document_id: 'DOC-1',
    document_name: 'Dokumen',
    status: 'DRAFT',
    is_active: true,
    page_count: 1,
    revision: 3,
    created_date: new Date(),
    modified_date: new Date(),
    is_deleted: false,
    ...over,
  } as MasterDocument;
}

function setup(doc: MasterDocument | null, contents: Partial<MasterDocumentContent>[] = []) {
  const calls: string[] = [];
  const manager = {
    findOne: jest.fn(async () => doc),
    find: jest.fn(async () => contents),
    delete: jest.fn(async () => { calls.push('delete'); }),
    insert: jest.fn(async () => { calls.push('insert'); }),
    save: jest.fn(async (e: any) => { calls.push('save'); return e; }),
    create: jest.fn((_: unknown, e: any) => e),
  };
  const docsRepo = {
    findOne: jest.fn(async () => doc),
    exists: jest.fn(async () => false),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((e: any) => e),
  };
  const contentsRepo = { find: jest.fn(async () => contents) };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const svc = new DocumentsService(docsRepo as any, contentsRepo as any, dataSource as any);
  return { svc, manager, docsRepo, calls };
}

describe('DocumentsService', () => {
  describe('create', () => {
    it('409 bila ID sudah dipakai (termasuk yang terhapus)', async () => {
      const { svc, docsRepo } = setup(null);
      docsRepo.exists.mockResolvedValue(true);
      await expect(svc.create({ document_id: 'X', document_name: 'Y' }, 'admin')).rejects.toThrow(ConflictException);
      // pengecekan tanpa filter is_deleted
      expect(docsRepo.exists).toHaveBeenCalledWith({ where: { document_id: 'X' } });
    });

    it('membuat DRAFT tanpa halaman dengan audit dari user', async () => {
      const { svc } = setup(null);
      const res = await svc.create({ document_id: 'X', document_name: 'Y' }, 'budi');
      expect(res).toMatchObject({ status: 'DRAFT', page_count: 0, revision: 0, created_by: 'budi' });
    });
  });

  describe('get', () => {
    it('hanya dokumen editor (read_only IS NULL); dokumen upload dianggap tidak ada (AC-UD-10)', async () => {
      const { svc, docsRepo } = setup(makeDoc());
      await svc.get('DOC-1');
      expect(docsRepo.findOne).toHaveBeenCalledWith({ where: { document_id: 'DOC-1', is_deleted: false, read_only: IsNull() } });
    });

    it('404 bila dokumen tidak ada atau terhapus', async () => {
      const { svc } = setup(null);
      await expect(svc.get('NOPE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('tidak mengubah status FINAL', async () => {
      const { svc } = setup(makeDoc({ status: 'FINAL' }));
      const res = await svc.update('DOC-1', { document_name: 'Baru' }, 'admin');
      expect(res).toMatchObject({ document_name: 'Baru', status: 'FINAL' });
    });
  });

  describe('saveContent', () => {
    const pages = [{ page: 1, content_html: '<p>a</p>' }, { page: 2, content_html: '<p>b</p>' }];

    it('400 bila page tidak berurutan', async () => {
      const { svc, manager } = setup(makeDoc());
      await expect(
        svc.saveContent('DOC-1', { revision: 3, pages: [{ page: 1, content_html: '' }, { page: 3, content_html: '' }] }, 'a'),
      ).rejects.toThrow(BadRequestException);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('413 bila satu halaman melebihi 512 KB', async () => {
      const { svc } = setup(makeDoc());
      const big = '<p>' + 'x'.repeat(MAX_PAGE_BYTES) + '</p>';
      await expect(svc.saveContent('DOC-1', { revision: 3, pages: [{ page: 1, content_html: big }] }, 'a')).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('409 bila revision berbeda dan konten tidak disentuh (AC-13)', async () => {
      const { svc, manager } = setup(makeDoc({ revision: 5 }));
      await expect(svc.saveContent('DOC-1', { revision: 4, pages }, 'a')).rejects.toThrow(ConflictException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('404 bila dokumen terhapus', async () => {
      const { svc } = setup(null);
      await expect(svc.saveContent('DOC-1', { revision: 0, pages }, 'a')).rejects.toThrow(NotFoundException);
    });

    it('mengganti konten dalam transaksi, menaikkan revision, FINAL -> DRAFT (AC-09)', async () => {
      const { svc, manager, calls } = setup(makeDoc({ status: 'FINAL', revision: 3 }));
      const res = await svc.saveContent(
        'DOC-1',
        { revision: 3, pages: [{ page: 1, content_html: '<p onclick="x()">a<script>1</script></p>' }, pages[1]] },
        'budi',
      );
      expect(calls).toEqual(['delete', 'insert', 'save']);
      expect(manager.findOne).toHaveBeenCalledWith(MasterDocument, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
      expect(res).toMatchObject({ revision: 4, status: 'DRAFT', page_count: 2 });
      expect(res.pages[0].content_html).toBe('<p>a</p>');
      const inserted = (manager.insert.mock.calls[0] as unknown[])[1] as Array<Record<string, unknown>>;
      expect(inserted).toHaveLength(2);
      expect(inserted[0]).toMatchObject({ document_id: 'DOC-1', page: 1, content_html: '<p>a</p>', created_by: 'budi' });
    });
  });

  describe('saveContent - header/footer', () => {
    it('menyimpan field header/footer yang dikirim, field lain tetap', async () => {
      const { svc } = setup(makeDoc({ footer_right: 'Halaman {page} dari {pages}', header_left: 'lama' }));
      const res = await svc.saveContent(
        'DOC-1',
        { revision: 3, pages: [{ page: 1, content_html: '<p>a</p>' }], header_footer: { header_center: 'Judul', hide_header_footer_first_page: true } },
        'a',
      );
      expect(res).toMatchObject({
        header_left: 'lama',
        header_center: 'Judul',
        footer_right: 'Halaman {page} dari {pages}',
        hide_header_footer_first_page: true,
      });
    });
  });

  describe('finalize', () => {
    it('ditolak bila dokumen kosong (AC-10)', async () => {
      const { svc } = setup(makeDoc(), [{ content_html: '<p></p>' }]);
      await expect(svc.finalize('DOC-1', { revision: 3 }, 'a')).rejects.toThrow('Dokumen masih kosong');
    });

    it('409 bila revision usang', async () => {
      const { svc } = setup(makeDoc({ revision: 9 }), [{ content_html: '<p>a</p>' }]);
      await expect(svc.finalize('DOC-1', { revision: 3 }, 'a')).rejects.toThrow(ConflictException);
    });

    it('mengubah status ke FINAL', async () => {
      const { svc } = setup(makeDoc(), [{ content_html: '<p>a</p>' }]);
      await expect(svc.finalize('DOC-1', { revision: 3 }, 'a')).resolves.toMatchObject({ status: 'FINAL', modified_by: 'a' });
    });
  });

  describe('duplicate', () => {
    it('menyalin header + halaman sebagai DRAFT dengan nama default (AC-14)', async () => {
      const { svc, manager } = setup(makeDoc({ status: 'FINAL', document_name: 'Asli', header_center: 'Kop' }), [
        { page: 1, content_html: '<p>1</p>' },
        { page: 2, content_html: '<p>2</p>' },
      ]);
      const res = await svc.duplicate('DOC-1', { document_id: 'DOC-2' }, 'a');
      expect(res).toMatchObject({ document_id: 'DOC-2', document_name: 'Salinan dari Asli', status: 'DRAFT', page_count: 2, revision: 0, header_center: 'Kop' });
      const inserted = (manager.insert.mock.calls[0] as unknown[])[1] as Array<Record<string, unknown>>;
      expect(inserted.map((p) => [p.document_id, p.page])).toEqual([['DOC-2', 1], ['DOC-2', 2]]);
    });

    it('409 bila ID tujuan sudah dipakai', async () => {
      const { svc, docsRepo } = setup(makeDoc());
      docsRepo.exists.mockResolvedValue(true);
      await expect(svc.duplicate('DOC-1', { document_id: 'DOC-2' }, 'a')).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft delete header', async () => {
      const { svc, docsRepo } = setup(makeDoc());
      await expect(svc.remove('DOC-1', 'a')).resolves.toEqual({ ok: true });
      expect(docsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_deleted: true, modified_by: 'a' }));
    });
    it('404 bila tidak ada', async () => {
      const { svc } = setup(null);
      await expect(svc.remove('NOPE', 'a')).rejects.toThrow(NotFoundException);
    });
  });
});
