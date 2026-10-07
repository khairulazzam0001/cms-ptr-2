import type { HeaderFooter } from './headerFooter';

export type DocumentStatus = 'DRAFT' | 'FINAL';

export type DocumentHeader = HeaderFooter & {
  document_id: string;
  document_name: string;
  document_desc?: string | null;
  status: DocumentStatus;
  is_active: boolean;
  page_count: number;
  revision: number;
  modified_date: string;
  modified_by?: string | null;
};

export type DocumentPage = { page: number; content_html: string };

export type DocumentDetail = DocumentHeader & { pages: DocumentPage[] };

export type SaveContentResult = HeaderFooter & Pick<DocumentHeader, 'revision' | 'status' | 'page_count' | 'modified_date'> & {
  pages: DocumentPage[];
};

export const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
