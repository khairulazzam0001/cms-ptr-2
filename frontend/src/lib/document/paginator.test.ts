import { describe, expect, it } from 'vitest';
import { BlockMeasure, groupRows, paginate } from './paginator';

const C = 100; // tinggi area konten uji
const block = (h: number, mb = 0, pageBreak = false): BlockMeasure => ({ kind: 'block', h, mb, pageBreak });
const units = (...hs: number[]) => hs.map((h, i) => ({ from: i, to: i + 1, h }));

describe('paginate - blok', () => {
  it('blok yang muat tetap di satu halaman', () => {
    const l = paginate([block(40), block(50)], C);
    expect(l.pages).toEqual([[{ index: 0 }, { index: 1 }]]);
    expect(l.starts).toEqual([]);
  });

  it('blok yang tidak muat dipindah utuh (FR-22, AC-03)', () => {
    const l = paginate([block(60), block(50)], C);
    expect(l.pages).toEqual([[{ index: 0 }], [{ index: 1 }]]);
    expect(l.starts).toEqual([{ index: 1, sub: undefined, remaining: 40 }]);
  });

  it('margin-bottom blok terakhir boleh melewati batas', () => {
    const l = paginate([block(50), block(58, 8)], C);
    expect(l.pages).toHaveLength(1);
  });

  it('page break manual memaksa halaman baru (FR-25, AC-05)', () => {
    const l = paginate([block(10), block(0, 0, true), block(10)], C);
    expect(l.pages).toEqual([[{ index: 0 }, { index: 1 }], [{ index: 2 }]]);
    expect(l.starts[0]).toMatchObject({ index: 2, remaining: 90 });
  });

  it('page break di akhir dokumen tidak membuat halaman kosong', () => {
    expect(paginate([block(10), block(0, 0, true)], C).pages).toHaveLength(1);
  });

  it('blok lebih tinggi dari satu halaman ditandai overflow di halaman sendiri (FR-26)', () => {
    const l = paginate([block(30), block(150), block(10)], C);
    expect(l.pages).toEqual([[{ index: 0 }], [{ index: 1 }], [{ index: 2 }]]);
    expect(l.overflow).toEqual([{ index: 1 }]);
  });
});

describe('paginate - tabel', () => {
  const table = (headerH: number, ...hs: number[]): BlockMeasure => ({ kind: 'table', overhead: 2, mb: 0, units: units(...hs), headerH });

  it('tabel dipecah per baris, header diulang di halaman lanjutan (FR-23)', () => {
    // header 10 + 6 baris x 20; halaman 1 sisa 70 -> overhead 2 + header 10 + 2 baris = 52
    const l = paginate([block(30), table(10, 10, 20, 20, 20, 20, 20, 20)], C);
    expect(l.pages[0]).toEqual([{ index: 0 }, { index: 1, from: 0, to: 3 }]);
    expect(l.pages[1]).toEqual([{ index: 1, from: 3, to: 7 }]); // 2 + header 10 + 4 x 20 = 92
    // reserve: overhead 2 + header 10 yang disisakan editor di awal halaman lanjutan
    expect(l.starts[0]).toEqual({ index: 1, sub: 3, remaining: 18, reserve: 12 });
  });

  it('tinggi header ulang dihitung di halaman lanjutan', () => {
    // halaman 2: overhead 2 + header 10 + 4 x 20 = 92 <= 100; baris ke-5 tidak muat
    const l = paginate([table(10, 10, ...Array(9).fill(20))], C);
    expect(l.pages.map((p) => p.map((f) => [f.from, f.to]))).toEqual([[[0, 5]], [[5, 9]], [[9, 10]]]);
  });

  it('header tidak tertinggal sendirian di bawah halaman', () => {
    const l = paginate([block(80), table(10, 10, 20, 20)], C);
    expect(l.pages[0]).toEqual([{ index: 0 }]);
    expect(l.starts[0]).toMatchObject({ index: 1, sub: undefined });
  });

  it('tabel tanpa header tidak menambah tinggi lanjutan', () => {
    const l = paginate([table(0, 30, 30, 30, 30)], C);
    expect(l.pages.map((p) => p.map((f) => [f.from, f.to]))).toEqual([[[0, 3]], [[3, 4]]]);
  });

  it('baris lebih tinggi dari halaman ditandai overflow', () => {
    const l = paginate([table(0, 20, 150, 20)], C);
    expect(l.overflow).toEqual([{ index: 0, sub: 1 }]);
    expect(l.pages).toHaveLength(3);
  });
});

describe('paginate - list', () => {
  it('list dipecah per item (FR-24)', () => {
    const list: BlockMeasure = { kind: 'list', overhead: 0, mb: 0, units: units(40, 40, 40) };
    const l = paginate([list], C);
    expect(l.pages).toEqual([[{ index: 0, from: 0, to: 2 }], [{ index: 0, from: 2, to: 3 }]]);
    expect(l.starts).toEqual([{ index: 0, sub: 2, remaining: 20 }]);
    expect(l.lastUsed).toBe(40);
  });
});

describe('paginate - paragraf dipecah per baris', () => {
  // baris 10px, offset konten 10 per baris
  const para = (n: number, mb = 0): BlockMeasure => {
    const lines = Array.from({ length: n }, (_, i) => ({ from: i * 10, to: (i + 1) * 10, h: 10 }));
    return { kind: 'block', h: n * 10 + mb, mb, lines: () => lines };
  };

  it('paragraf yang tidak muat dipecah di batas baris', () => {
    // sisa 45 -> 4 baris (40) di halaman 1, 6 baris di halaman 2
    const l = paginate([block(55), para(10)], C);
    expect(l.pages).toEqual([[{ index: 0 }, { index: 1, from: 0, to: 40 }], [{ index: 1, from: 40, to: 100 }]]);
    expect(l.starts).toEqual([{ index: 1, sub: 40, remaining: 5 }]);
    expect(l.lastUsed).toBe(60);
  });

  it('orphan: kurang dari 2 baris di bawah halaman -> paragraf pindah utuh', () => {
    const l = paginate([block(85), para(6)], C);
    expect(l.pages).toEqual([[{ index: 0 }], [{ index: 1 }]]);
    expect(l.starts).toEqual([{ index: 1, sub: undefined, remaining: 15 }]);
  });

  it('widow: minimal 2 baris dibawa ke halaman berikutnya', () => {
    // sisa 50 muat 5 dari 6 baris -> hanya 4 di halaman 1, 2 di halaman 2
    const l = paginate([block(50), para(6)], C);
    expect(l.pages[0][1]).toEqual({ index: 1, from: 0, to: 40 });
    expect(l.pages[1]).toEqual([{ index: 1, from: 40, to: 60 }]);
  });

  it('paragraf <= 3 baris tidak dipecah', () => {
    const l = paginate([block(85), para(3)], C);
    expect(l.pages).toEqual([[{ index: 0 }], [{ index: 1 }]]);
  });

  it('paragraf lebih tinggi dari halaman dipecah ke beberapa halaman tanpa overflow', () => {
    const l = paginate([para(25)], C);
    expect(l.pages.map((p) => p.map((f) => [f.from, f.to]))).toEqual([[[0, 100]], [[100, 200]], [[200, 250]]]);
    expect(l.overflow).toEqual([]);
  });

  it('baris hanya diukur bila paragraf perlu dipecah', () => {
    let calls = 0;
    const lazy: BlockMeasure = { kind: 'block', h: 20, mb: 0, lines: () => { calls++; return []; } };
    paginate([lazy, lazy], C);
    expect(calls).toBe(0);
  });
});

describe('groupRows', () => {
  it('baris terikat rowspan menjadi satu unit', () => {
    expect(groupRows([[1, 1], [2, 1], [1], [1, 1]], [10, 20, 30, 40])).toEqual([
      { from: 0, to: 1, h: 10 },
      { from: 1, to: 3, h: 50 },
      { from: 3, to: 4, h: 40 },
    ]);
  });
});
