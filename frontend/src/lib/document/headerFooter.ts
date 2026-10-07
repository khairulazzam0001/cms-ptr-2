// Header/footer dokumen: 3 slot teks polos (kiri/tengah/kanan) di margin atas & bawah.
// Token {page} = nomor halaman, {pages} = jumlah halaman.

export type HeaderFooter = {
  header_left: string;
  header_center: string;
  header_right: string;
  footer_left: string;
  footer_center: string;
  footer_right: string;
  hide_header_footer_first_page: boolean;
};

export const HF_SLOTS = ['left', 'center', 'right'] as const;
export const HF_MAX_LENGTH = 200;

export const EMPTY_HEADER_FOOTER: HeaderFooter = {
  header_left: '',
  header_center: '',
  header_right: '',
  footer_left: '',
  footer_center: '',
  footer_right: 'Halaman {page} dari {pages}',
  hide_header_footer_first_page: false,
};

export function pickHeaderFooter(src: Partial<HeaderFooter>): HeaderFooter {
  const out = { ...EMPTY_HEADER_FOOTER };
  for (const key of Object.keys(out) as (keyof HeaderFooter)[]) {
    if (src[key] !== undefined && src[key] !== null) (out as Record<keyof HeaderFooter, unknown>)[key] = src[key];
  }
  return out;
}

export function formatSlot(text: string, page: number, pages: number): string {
  return text.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages));
}

export function isHeaderFooterVisible(hf: HeaderFooter, page: number): boolean {
  return !(page === 1 && hf.hide_header_footer_first_page);
}
