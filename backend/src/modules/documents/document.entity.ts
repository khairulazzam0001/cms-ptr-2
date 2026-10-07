import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const DOCUMENT_STATUSES = ['DRAFT', 'FINAL'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// master_document.read_only: 'document' = dokumen hasil upload HTML (PRD_Upload_Document.md),
// NULL = dokumen dari editor (Document Generator). Kedua modul tidak saling memproses.
export const READ_ONLY_DOCUMENT = 'document';

export const DEFAULT_FOOTER_RIGHT = 'Halaman {page} dari {pages}';
export const HEADER_FOOTER_FIELDS = [
  'header_left',
  'header_center',
  'header_right',
  'footer_left',
  'footer_center',
  'footer_right',
  'hide_header_footer_first_page',
] as const;

// ============ master_document (header) ============
@Entity('master_document')
export class MasterDocument {
  @PrimaryColumn({ length: 50 })
  document_id: string;

  @Column({ length: 150 })
  document_name: string;

  @Column({ type: 'text', nullable: true })
  document_desc?: string;

  @Column({ type: 'varchar', length: 10, default: 'DRAFT' })
  status: DocumentStatus;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  read_only?: string | null;

  // Denormalisasi jumlah halaman untuk list (tanpa join ke konten)
  @Column({ type: 'int', default: 0 })
  page_count: number;

  // Naik setiap konten disimpan; deteksi konflik antar tab/sesi
  @Column({ type: 'int', default: 0 })
  revision: number;

  // Header/footer: teks polos per slot, token {page} dan {pages}. Tampil di margin atas/bawah.
  @Column({ length: 200, default: '' }) header_left: string;
  @Column({ length: 200, default: '' }) header_center: string;
  @Column({ length: 200, default: '' }) header_right: string;
  @Column({ length: 200, default: '' }) footer_left: string;
  @Column({ length: 200, default: '' }) footer_center: string;
  @Column({ length: 200, default: DEFAULT_FOOTER_RIGHT }) footer_right: string;

  // Sembunyikan header/footer di halaman 1 (mis. sampul); penomoran tetap mulai dari 1
  @Column({ default: false })
  hide_header_footer_first_page: boolean;

  @Column({ nullable: true })
  created_by?: string;

  @CreateDateColumn()
  created_date: Date;

  @Column({ nullable: true })
  modified_by?: string;

  @UpdateDateColumn()
  modified_date: Date;

  @Column({ default: false })
  is_deleted: boolean;
}

// ============ master_document_content (isi per halaman A4) ============
// Pengecualian aturan soft delete (PRD Document Generator §5.2): baris konten lama dihapus fisik
// saat konten diganti, karena MySQL tidak punya partial unique index untuk (document_id, page).
@Entity('master_document_content')
@Unique('UQ_document_content_page', ['document_id', 'page'])
export class MasterDocumentContent {
  @PrimaryGeneratedColumn('uuid')
  document_content_id: string;

  @Column({ length: 50 })
  document_id: string;

  @ManyToOne(() => MasterDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document?: MasterDocument;

  @Column({ type: 'int' })
  page: number;

  @Column({ type: 'mediumtext' })
  content_html: string;

  @Column({ nullable: true })
  created_by?: string;

  @CreateDateColumn()
  created_date: Date;

  @Column({ nullable: true })
  modified_by?: string;

  @UpdateDateColumn()
  modified_date: Date;

  @Column({ default: false })
  is_deleted: boolean;
}
