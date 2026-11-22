import { MatrixRawRow, RawRow } from './bars-format';
import { cleanText, parseBarsRows, parseMatrixRows } from './bars-parser';

const KA = new Set(['CI1', 'CI2']);
let rowNo = 1;
const row = (cells: RawRow['cells']): RawRow => ({ row: ++rowNo, cells });
beforeEach(() => { rowNo = 1; });

const base = { key_action_id: 'CI1', bars_type: 'POSITIVE', bars_no: 1, bars_name: 'Menemukan masalah' };

describe('parseBarsRows', () => {
  it('mengelompokkan behaviour ke BARS dan membuat ID sesuai pola data (PRD §6)', () => {
    const { bars, errors } = parseBarsRows(
      [
        row({ ...base, behaviour_no: 1, behaviour: 'Membaca data', weight: 2, need_ai: 'FALSE' }),
        row({ ...base, behaviour_no: 2, behaviour: 'Menyimpulkan' }),
        row({ key_action_id: 'CI1', bars_type: 'negative', bars_no: '1', bars_name: 'Keliru' }),
      ],
      'bottleneck',
      KA,
    );
    expect(errors).toEqual([]);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ bars_id: 'CI1-POSITIVE-bottleneck-1', need_ai: false, bars_no: 1 });
    expect(bars[0].behaviours.map((b) => [b.bars_behaviour_id, b.weight])).toEqual([
      ['CI1-POSITIVE-bottleneck-1-1', 2],
      ['CI1-POSITIVE-bottleneck-1-2', 1],
    ]);
    // bars_type huruf kecil dinormalisasi; BARS tanpa behaviour; need_ai kosong = true
    expect(bars[1]).toMatchObject({ bars_id: 'CI1-NEGATIVE-bottleneck-1', bars_type: 'NEGATIVE', need_ai: true, behaviours: [] });
  });

  it('error per baris & kolom untuk nilai tidak valid (AC-IB-04)', () => {
    const { errors } = parseBarsRows(
      [
        row({ key_action_id: 'XX9', bars_type: 'POSITIF', bars_no: '', bars_name: 'a' }),
        row({ ...base, behaviour: 'x' }),
        row({ ...base, behaviour_no: 1, behaviour: 'x', weight: 0 }),
        row({ ...base, need_ai: 'mungkin' }),
        row({ ...base, behaviour_no: 1.5, behaviour: 'x' }),
        row({ ...base, behaviour_no: 2 }),
      ],
      'sim',
      KA,
    );
    expect(errors.map((e) => [e.row, e.column])).toEqual([
      [2, 'key_action_id'],
      [2, 'bars_type'],
      [2, 'bars_no'],
      [3, 'behaviour_no'],
      [4, 'weight'],
      [5, 'need_ai'],
      [6, 'behaviour_no'],
      [7, 'behaviour'],
    ]);
  });

  it('bars_name / need_ai harus konsisten dalam BARS yang sama (AC-IB-05)', () => {
    const { errors } = parseBarsRows(
      [
        row({ ...base, behaviour_no: 1, behaviour: 'a' }),
        row({ ...base, bars_name: 'Nama lain', behaviour_no: 2, behaviour: 'b' }),
        row({ ...base, behaviour_no: 3, behaviour: 'c', need_ai: 'FALSE' }),
      ],
      'sim',
      KA,
    );
    expect(errors.map((e) => e.column)).toEqual(['bars_name', 'need_ai']);
  });

  it('behaviour_no ganda dan campuran baris tanpa/dengan behaviour ditolak', () => {
    const { errors } = parseBarsRows(
      [
        row({ ...base, behaviour_no: 1, behaviour: 'a' }),
        row({ ...base, behaviour_no: 1, behaviour: 'b' }),
        row({ ...base }),
        row({ ...base, bars_no: 2 }),
        row({ ...base, bars_no: 2 }),
        row({ ...base, bars_no: 2, behaviour_no: 1, behaviour: 'c' }),
      ],
      'sim',
      KA,
    );
    expect(errors.map((e) => [e.row, e.column])).toEqual([
      [3, 'behaviour_no'],
      [4, 'behaviour'],
      [6, 'bars_no'],
      [7, 'behaviour'],
    ]);
  });

  it('ID lebih dari 50 karakter -> error, tidak dipendekkan', () => {
    const { errors, bars } = parseBarsRows([row({ ...base })], 'simulation-dengan-id-yang-sangat-panjang-sekali-x', KA);
    expect(bars).toEqual([]);
    expect(errors[0].message).toMatch(/melebihi 50 karakter/);
  });

  it('zero-width space & spasi tepi dibuang (AC-IB-12)', () => {
    expect(cleanText('  Continuous Improvement​​ ')).toBe('Continuous Improvement');
    const { bars } = parseBarsRows([row({ ...base, bars_name: 'Nama​', behaviour_no: 1, behaviour: '﻿Isi' })], 'sim', KA);
    expect(bars[0].bars_name).toBe('Nama');
    expect(bars[0].behaviours[0].bars_behaviour).toBe('Isi');
  });

  it('need_ai menerima TRUE/FALSE, 1/0, YA/TIDAK dan boolean Excel', () => {
    const { bars, errors } = parseBarsRows(
      [
        row({ ...base, bars_no: 1, need_ai: 'ya' }),
        row({ ...base, bars_no: 2, need_ai: 0 }),
        row({ ...base, bars_no: 3, need_ai: false }),
        row({ ...base, bars_no: 4, need_ai: 'Tidak' }),
      ],
      'sim',
      KA,
    );
    expect(errors).toEqual([]);
    expect(bars.map((b) => b.need_ai)).toEqual([true, false, false, false]);
  });
});

// Format matriks: [key_action_id, POSITIVE, POSITIVE behaviour, NETRAL, NETRAL behaviour, NEGATIVE, NEGATIVE behaviour]
const m = (row: number, cells: (string | null)[]): MatrixRawRow => ({
  row,
  key_action_id: cells[0] ?? null,
  bars: { POSITIVE: cells[1] ?? null, NETRAL: cells[3] ?? null, NEGATIVE: cells[5] ?? null },
  behaviours: { POSITIVE: cells[2] ?? null, NETRAL: cells[4] ?? null, NEGATIVE: cells[6] ?? null },
});
const KA_BA = new Set(['BA1', 'CI1']);
const summarize = (bars: ReturnType<typeof parseMatrixRows>['bars']) =>
  bars.map((b) => [b.bars_id, b.bars_name, b.need_ai, b.behaviours.map((h) => `${h.bars_behaviour_id}=${h.bars_behaviour}|${h.weight}`)]);

describe('parseMatrixRows (format matriks)', () => {
  it('contoh template user: BARS di 1 baris, behaviour di baris bawahnya', () => {
    const { bars, errors } = parseMatrixRows([
      m(2, ['BA1', 'Ini Bars Satu Positive', null, 'Ini Bars Satu NETRAL', null, 'Ini Bars Satu NEGATIVE', null]),
      m(3, [null, null, 'Ini Bars Satu Positive - Bars Behaviour 1', null, 'Ini Bars Satu NETRAL - Bars Behaviour 1', null, 'Ini Bars Satu NEGATIVE - Bars Behaviour 1']),
      m(4, [null, null, 'Ini Bars Satu Positive - Bars Behaviour 2', null, null, null, null]),
      m(5, [null, 'Ini Bars Dua Positive', null, null, null, null, null]),
      m(6, [null, null, 'Ini Bars Dua Positive - Bars Behaviour 1', null, null, null, null]),
    ], 'sim', KA_BA);
    expect(errors).toEqual([]);
    expect(summarize(bars)).toEqual([
      ['BA1-POSITIVE-sim-1', 'Ini Bars Satu Positive', true, ['BA1-POSITIVE-sim-1-1=Ini Bars Satu Positive - Bars Behaviour 1|1', 'BA1-POSITIVE-sim-1-2=Ini Bars Satu Positive - Bars Behaviour 2|1']],
      ['BA1-NETRAL-sim-1', 'Ini Bars Satu NETRAL', true, ['BA1-NETRAL-sim-1-1=Ini Bars Satu NETRAL - Bars Behaviour 1|1']],
      ['BA1-NEGATIVE-sim-1', 'Ini Bars Satu NEGATIVE', true, ['BA1-NEGATIVE-sim-1-1=Ini Bars Satu NEGATIVE - Bars Behaviour 1|1']],
      ['BA1-POSITIVE-sim-2', 'Ini Bars Dua Positive', true, ['BA1-POSITIVE-sim-2-1=Ini Bars Dua Positive - Bars Behaviour 1|1']],
    ]);
  });

  it('behaviour boleh sebaris dengan BARS; blok key action baru mengulang nomor dari 1', () => {
    const { bars, errors } = parseMatrixRows([
      m(2, ['BA1', 'P1', 'p1.1', null, null, 'N1', null]),
      m(3, [null, null, 'p1.2', null, null, null, null]),
      m(4, ['CI1', 'P1 CI1', 'x', null, null, null, null]),
    ], 'sim', KA_BA);
    expect(errors).toEqual([]);
    expect(summarize(bars)).toEqual([
      ['BA1-POSITIVE-sim-1', 'P1', true, ['BA1-POSITIVE-sim-1-1=p1.1|1', 'BA1-POSITIVE-sim-1-2=p1.2|1']],
      ['BA1-NEGATIVE-sim-1', 'N1', true, []],
      ['CI1-POSITIVE-sim-1', 'P1 CI1', true, ['CI1-POSITIVE-sim-1-1=x|1']],
    ]);
  });

  it('error: baris pertama tanpa key action, behaviour tanpa BARS, key action tidak ada / ganda', () => {
    const { bars, errors } = parseMatrixRows([
      m(2, [null, 'Yatim', null, null, null, null, null]),
      m(3, ['BA1', null, 'tanpa bars', null, null, null, null]),
      m(4, [null, 'P1', null, null, null, null, null]),
      m(5, ['XX9', 'P1', null, null, null, null, null]),
      m(6, [null, 'ikut dilewati', null, null, null, null, null]),
      m(7, ['ba1', 'P lagi', null, null, null, null, null]),
    ], 'sim', KA_BA);
    expect(errors.map((e) => [e.row, e.column])).toEqual([
      [2, 'key_action_id'],
      [3, 'POSITIVE behaviour'],
      [5, 'key_action_id'],
      [7, 'key_action_id'],
    ]);
    expect(errors[3].message).toContain('baris 3');
    expect(bars.map((b) => b.bars_id)).toEqual(['BA1-POSITIVE-sim-1']);
  });

  it('ID melebihi 50 karakter -> error di kolom tipe', () => {
    const longKa = 'K'.repeat(40);
    const { errors } = parseMatrixRows([m(2, [longKa, 'P', null, null, null, null, null])], 'sim', new Set([longKa]));
    expect(errors).toEqual([expect.objectContaining({ row: 2, column: 'POSITIVE' })]);
  });
});
