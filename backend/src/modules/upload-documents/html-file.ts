import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { extname } from 'path';

// Validasi file HTML upload (PRD_Upload_Document.md FR-UD-11). Isi TIDAK disanitasi (disimpan utuh);
// keamanan ada di cara render (iframe sandbox + CSP) dan unduhan sebagai attachment.
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
const EXTENSIONS = ['.html', '.htm'];

export type UploadedHtml = { originalname: string; size: number; buffer: Buffer };

export function readHtmlFile(file: UploadedHtml | undefined): string {
  if (!file) throw new BadRequestException('File wajib diisi');
  if (!EXTENSIONS.includes(extname(file.originalname || '').toLowerCase()))
    throw new BadRequestException('File harus berekstensi .html atau .htm');
  if (file.size > MAX_HTML_BYTES) throw new PayloadTooLargeException('Ukuran file maksimal 2 MB');
  if (file.size === 0) throw new BadRequestException('File kosong');

  let html: string;
  try {
    // fatal: byte non-UTF-8 ditolak; BOM UTF-8 otomatis dibuang
    html = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw new BadRequestException('File harus berupa teks UTF-8');
  }
  if (html.includes('\u0000')) throw new BadRequestException('File harus berupa teks UTF-8');
  if (!html.trim()) throw new BadRequestException('File kosong');
  if (!/<[a-z!][^>]*>/i.test(html)) throw new BadRequestException('File tidak berisi tag HTML');
  return html;
}

// Peringatan informatif (tidak menolak upload): bagian yang tidak jalan / tidak dimuat di preview CMS
export function htmlWarnings(html: string): string[] {
  const warnings: string[] = [];
  if (/<script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html))
    warnings.push('File memuat script/event handler; tidak dijalankan di preview CMS.');
  if (/(?:src|href|action|srcset)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(html) || /(?:url\(|@import)\s*["']?\s*(?:https?:)?\/\//i.test(html))
    warnings.push('File memuat resource eksternal (http/https); tidak dimuat di preview CMS.');
  return warnings;
}
