import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MasterDocument, MasterDocumentContent, READ_ONLY_DOCUMENT } from '../documents/document.entity';
import { UploadDocumentsService } from './upload-documents.service';

const HTML = '<!doctype html><html><body><p>Halo</p></body></html>';
const htmlFile = (content = HTML, originalname = 'laporan.html') => {
  const buffer = Buffer.from(content, 'utf8');
  return { originalname, size: buffer.length, buffer };
};

function makeDoc(over: Partial<MasterDocument> = {}): MasterDocument {
  return {
    document_id: 'UP-1',
    document_name: 'Upload',
    status: 'FINAL',
    is_active: true,
    read_only: READ_ONLY_DOCUMENT,
    page_count: 0,
    revision: 2,
    is_deleted: false,
    ...over,
  } as MasterDocument;
}

function setup(doc: MasterDocument | null, content: string | null = HTML, updateAffected = 1) {
  const calls: string[] = [];
  const manager = {
    findOne: jest.fn(async () => doc),
    save: jest.fn(async (e: any) => { calls.push('save'); return e; }),
    create: jest.fn((_: unknown, e: any) => e),
    insert: jest.fn(async () => { calls.push('insert'); }),
    update: jest.fn(async () => { calls.push('update'); return { affected: updateAffected }; }),
  };
  const docsRepo = {
    findOne: jest.fn(async () => doc),
    exists: jest.fn(async () => false),
    save: jest.fn(async (e: any) => e),
  };
  const contentsRepo = { findOne: jest.fn(async () => (content === null ? null : { content_html: content })) };
  const dataSource = { transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) };
  const svc = new UploadDocumentsService(docsRepo as any, contentsRepo as any, dataSource as any);
  return { svc, manager, docsRepo, contentsRepo, calls };
}

describe('UploadDocumentsService', () => {
  describe('create', () => {
    it('header read_only=document, FINAL, page_count 0 + tepat 1 baris konten page 0 berisi utuh (AC-UD-01)', async () => {
      const { svc, manager } = setup(null);
      const res = await svc.create({ document_id: 'UP-1', document_name: 'Laporan' }, htmlFile(), 'budi');
      expect(manager.create).toHaveBeenCalledWith(
        MasterDocument,
        expect.objectContaining({ read_only: READ_ONLY_DOCUMENT, status: 'FINAL', page_count: 0, revision: 0, created_by: 'budi' }),
      );
      expect(manager.insert).toHaveBeenCalledTimes(1);
      expect(manager.insert).toHaveBeenCalledWith(
        MasterDocumentContent,
        expect.objectContaining({ document_id: 'UP-1', page: 0, content_html: HTML }),
      );
      expect(res).toMatchObject({ size_bytes: Buffer.byteLength(HTML), warnings: [] });
    });

    it('409 bila ID sudah dipakai (lintas modul, termasuk terhapus) (AC-UD-02)', async () => {
      const { svc, docsRepo, manager } = setup(null);
      docsRepo.exists.mockResolvedValue(true);
      await expect(svc.create({ document_id: 'UP-1', document_name: 'x' }, htmlFile(), 'a')).rejects.toThrow(ConflictException);
      expect(docsRepo.exists).toHaveBeenCalledWith({ where: { document_id: 'UP-1' } });
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('400 untuk file tidak valid tanpa menyentuh DB (AC-UD-03)', async () => {
      const { svc, docsRepo } = setup(null);
      await expect(svc.create({ document_id: 'UP-1', document_name: 'x' }, htmlFile(HTML, 'a.pdf'), 'a')).rejects.toThrow(BadRequestException);
      expect(docsRepo.exists).not.toHaveBeenCalled();
    });

    it('mengembalikan peringatan script / resource eksternal', async () => {
      const { svc } = setup(null);
      const res = await svc.create({ document_id: 'UP-1', document_name: 'x' }, htmlFile('<p>a</p><script>x()</script><img src="https://a/b.png">'), 'a');
      expect(res.warnings).toHaveLength(2);
    });
  });

  describe('replaceFile (AC-UD-05)', () => {
    it('update baris page 0, revision + 1, status tetap FINAL', async () => {
      const { svc, manager, calls } = setup(makeDoc());
      const res = await svc.replaceFile('UP-1', htmlFile('<p>baru</p>'), 'budi');
      expect(manager.findOne).toHaveBeenCalledWith(MasterDocument, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
      expect(manager.update).toHaveBeenCalledWith(
        MasterDocumentContent,
        { document_id: 'UP-1', page: 0 },
        expect.objectContaining({ content_html: '<p>baru</p>', modified_by: 'budi' }),
      );
      expect(calls).toEqual(['update', 'save']);
      expect(res).toMatchObject({ revision: 3, status: 'FINAL', modified_by: 'budi' });
    });

    it('insert bila baris konten belum ada (tetap 1 baris)', async () => {
      const { svc, calls } = setup(makeDoc(), HTML, 0);
      await svc.replaceFile('UP-1', htmlFile(), 'a');
      expect(calls).toEqual(['update', 'insert', 'save']);
    });

    it('404 untuk dokumen editor / terhapus', async () => {
      const { svc } = setup(null);
      await expect(svc.replaceFile('DOC-1', htmlFile(), 'a')).rejects.toThrow(NotFoundException);
    });
  });

  describe('get / download / remove', () => {
    it('hanya memproses read_only = document (AC-UD-11)', async () => {
      const { svc, docsRepo } = setup(makeDoc());
      await svc.get('UP-1');
      expect(docsRepo.findOne).toHaveBeenCalledWith({ where: { document_id: 'UP-1', is_deleted: false, read_only: READ_ONLY_DOCUMENT } });
    });

    it('get mengembalikan isi + ukuran', async () => {
      const { svc } = setup(makeDoc());
      await expect(svc.get('UP-1')).resolves.toMatchObject({ content_html: HTML, size_bytes: Buffer.byteLength(HTML) });
    });

    it('download: nama {id}.html, isi identik (AC-UD-09)', async () => {
      const { svc } = setup(makeDoc());
      await expect(svc.download('UP-1')).resolves.toEqual({ filename: 'UP-1.html', html: HTML });
    });

    it('404 bila dokumen tidak ada', async () => {
      const { svc } = setup(null);
      await expect(svc.get('X')).rejects.toThrow(NotFoundException);
      await expect(svc.download('X')).rejects.toThrow(NotFoundException);
    });

    it('soft delete', async () => {
      const { svc, docsRepo } = setup(makeDoc());
      await expect(svc.remove('UP-1', 'a')).resolves.toEqual({ ok: true });
      expect(docsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ is_deleted: true }));
    });
  });
});
