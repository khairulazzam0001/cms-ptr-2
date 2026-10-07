import { describe, expect, it } from 'vitest';
import { EMPTY_HEADER_FOOTER, formatSlot, isHeaderFooterVisible, pickHeaderFooter } from './headerFooter';

describe('header/footer', () => {
  it('mengganti token {page} dan {pages}', () => {
    expect(formatSlot('Halaman {page} dari {pages}', 3, 12)).toBe('Halaman 3 dari 12');
    expect(formatSlot('{page}/{pages} - {page}', 1, 2)).toBe('1/2 - 1');
    expect(formatSlot('Tanpa token', 1, 2)).toBe('Tanpa token');
  });

  it('opsi sembunyikan di halaman pertama', () => {
    const hf = { ...EMPTY_HEADER_FOOTER, hide_header_footer_first_page: true };
    expect(isHeaderFooterVisible(hf, 1)).toBe(false);
    expect(isHeaderFooterVisible(hf, 2)).toBe(true);
    expect(isHeaderFooterVisible(EMPTY_HEADER_FOOTER, 1)).toBe(true);
  });

  it('pickHeaderFooter mengambil field dari data dokumen dan default untuk yang kosong', () => {
    const hf = pickHeaderFooter({ header_center: 'Kop', footer_right: undefined });
    expect(hf.header_center).toBe('Kop');
    expect(hf.footer_right).toBe('Halaman {page} dari {pages}');
  });
});
