// Upload Document (PRD_Upload_Document.md): dokumen HTML read-only. Isi HTML TIDAK disanitasi,
// jadi hanya boleh dirender lewat buildPreviewSrcdoc() di <iframe sandbox=""> (tanpa izin).

export type UploadDocument = {
  document_id: string;
  document_name: string;
  document_desc?: string | null;
  is_active: boolean;
  revision: number;
  size_bytes: number;
  modified_date: string;
  modified_by?: string | null;
};

export type UploadDocumentDetail = UploadDocument & { content_html: string };
export type UploadResult = UploadDocument & { warnings: string[] };

export const MAX_HTML_BYTES = 2 * 1024 * 1024;

// Diblokir: semua resource eksternal, form, plugin. Diizinkan: CSS inline/<style>, gambar & font data:.
export const PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; form-action 'none'";

// Validasi klien (server tetap yang menentukan, FR-UD-11)
export function checkHtmlFile(file: File): string | null {
  if (!/\.html?$/i.test(file.name)) return 'File harus berekstensi .html atau .htm';
  if (file.size === 0) return 'File kosong';
  if (file.size > MAX_HTML_BYTES) return 'Ukuran file maksimal 2 MB';
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// HTML untuk srcdoc preview: CSP + <base target="_blank"> disisipkan paling awal di <head>.
// <meta http-equiv="refresh"> dan <base> asli dibuang (refresh bisa mengalihkan iframe ke situs luar;
// CSP tidak memblokirnya). Link tidak bisa membuka halaman karena sandbox tanpa allow-popups.
// DOMParser tidak menjalankan script.
export function buildPreviewSrcdoc(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('meta[http-equiv], base').forEach((el) => {
    if (el.tagName === 'BASE' || /refresh|content-security-policy/i.test(el.getAttribute('http-equiv') || '')) el.remove();
  });
  const csp = doc.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', PREVIEW_CSP);
  const base = doc.createElement('base');
  base.setAttribute('target', '_blank');
  doc.head.prepend(csp, base);
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '';
  return doctype + doc.documentElement.outerHTML;
}
