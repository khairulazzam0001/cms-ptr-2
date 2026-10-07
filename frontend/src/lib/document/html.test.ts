import { describe, expect, it } from 'vitest';
import { mergePages, splitIntoPages } from './html';

const TABLE =
  '<table style="min-width: 50px"><colgroup><col><col></colgroup><tbody>' +
  '<tr><th><p>H1</p></th><th><p>H2</p></th></tr>' +
  '<tr><td><p>a</p></td><td><p>b</p></td></tr>' +
  '<tr><td><p>c</p></td><td><p>d</p></td></tr>' +
  '<tr><td><p>e</p></td><td><p>f</p></td></tr>' +
  '</tbody></table>';

describe('splitIntoPages', () => {
  it('blok utuh per halaman, page break ikut di akhir halaman', () => {
    const html = '<p>satu</p><div data-page-break="true"></div><h1>dua</h1>';
    expect(splitIntoPages(html, [[{ index: 0 }, { index: 1 }], [{ index: 2 }]])).toEqual([
      '<p>satu</p><div data-page-break="true"></div>',
      '<h1>dua</h1>',
    ]);
  });

  it('tabel lanjutan diberi data-continued + header ulang (§5.3, AC-04)', () => {
    const [p1, p2] = splitIntoPages(TABLE, [[{ index: 0, from: 0, to: 2 }], [{ index: 0, from: 2, to: 4 }]]);
    expect(p1).toBe(
      '<table style="min-width: 50px"><tbody><tr><th><p>H1</p></th><th><p>H2</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    );
    expect(p2).toBe(
      '<table style="min-width: 50px" data-continued="true"><thead data-repeated="true"><tr><th><p>H1</p></th><th><p>H2</p></th></tr></thead>' +
        '<tbody><tr><td><p>c</p></td><td><p>d</p></td></tr><tr><td><p>e</p></td><td><p>f</p></td></tr></tbody></table>',
    );
  });

  it('ordered list lanjutan meneruskan penomoran (FR-24)', () => {
    const html = '<ol start="3"><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ol>';
    const pages = splitIntoPages(html, [[{ index: 0, from: 0, to: 2 }], [{ index: 0, from: 2, to: 3 }]]);
    expect(pages[1]).toBe('<ol start="5" data-continued="true"><li><p>c</p></li></ol>');
  });
});

describe('paragraf dipecah per baris', () => {
  const P = '<p style="text-align: justify">Satu <strong>dua tiga</strong> empat<br>lima</p>';
  // offset: "Satu "0-5, "dua tiga"5-13, " empat"13-19, <br>19, "lima"20-24

  it('memotong di tengah mark, atribut paragraf ikut, potongan lanjutan bertanda data-continued', () => {
    expect(splitIntoPages(P, [[{ index: 0, from: 0, to: 9 }], [{ index: 0, from: 9, to: 24 }]])).toEqual([
      '<p style="text-align: justify" data-split="true">Satu <strong>dua </strong></p>',
      '<p style="text-align: justify" data-continued="true"><strong>tiga</strong> empat<br>lima</p>',
    ]);
  });

  it('memotong tepat setelah <br>', () => {
    const [, p2] = splitIntoPages(P, [[{ index: 0, from: 0, to: 20 }], [{ index: 0, from: 20, to: 24 }]]);
    expect(p2).toBe('<p style="text-align: justify" data-continued="true">lima</p>');
  });

  it('round-trip: potongan disambung kembali', () => {
    const pages = splitIntoPages(P, [[{ index: 0, from: 0, to: 9 }], [{ index: 0, from: 9, to: 20 }], [{ index: 0, from: 20, to: 24 }]]);
    expect(mergePages(pages)).toBe(
      '<p style="text-align: justify">Satu <strong>dua </strong><strong>tiga</strong> empat<br>lima</p>',
    );
  });
});

describe('mergePages (round-trip simpan -> muat, AC-08)', () => {
  it('menyatukan tabel lanjutan dan membuang header ulang', () => {
    const pages = splitIntoPages(TABLE, [[{ index: 0, from: 0, to: 2 }], [{ index: 0, from: 2, to: 3 }], [{ index: 0, from: 3, to: 4 }]]);
    const merged = mergePages(pages);
    const noColgroup = TABLE.replace('<colgroup><col><col></colgroup>', '');
    expect(merged).toBe(noColgroup);
  });

  it('menyatukan list lanjutan', () => {
    const html = '<p>x</p><ul><li><p>a</p></li><li><p>b</p></li></ul><p>y</p>';
    const pages = splitIntoPages(html, [[{ index: 0 }, { index: 1, from: 0, to: 1 }], [{ index: 1, from: 1, to: 2 }, { index: 2 }]]);
    expect(mergePages(pages)).toBe(html);
  });

  it('marker data-continued yatim dibuang', () => {
    expect(mergePages(['<p>a</p>', '<table data-continued="true"><tbody><tr><td>x</td></tr></tbody></table>'])).toBe(
      '<p>a</p><table><tbody><tr><td>x</td></tr></tbody></table>',
    );
  });
});
