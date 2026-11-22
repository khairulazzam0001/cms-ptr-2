import { RawRow } from './bars-format';
import { cleanText, parseBarsRows } from './bars-parser';

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
