// Validasi + pengelompokan baris sheet BARS (PRD_Import_BARS.md §5, §9). Fungsi murni.
import {
  BARS_TYPES,
  BarsType,
  DEFAULT_WEIGHT,
  MATRIX_KEY_COLUMN,
  MAX_ID_LENGTH,
  MatrixRawRow,
  ParsedBars,
  matrixBehaviourColumn,
  RawCell,
  RawRow,
  RowError,
  barsIdOf,
  behaviourIdOf,
} from './bars-format';

// Spasi tepi + karakter tak terlihat (zero-width, BOM) dibuang (PRD §5.3)
const INVISIBLE = /[​-‍⁠﻿]/g;
export function cleanText(value: RawCell | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(INVISIBLE, '').trim();
}

function parseInteger(value: RawCell | undefined): number | null | 'invalid' {
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : 'invalid';
}

const TRUE_VALUES = ['TRUE', '1', 'YA', 'Y', 'YES'];
const FALSE_VALUES = ['FALSE', '0', 'TIDAK', 'T', 'N', 'NO'];
function parseBoolean(value: RawCell | undefined): boolean | null | 'invalid' {
  if (typeof value === 'boolean') return value;
  const text = cleanText(value).toUpperCase();
  if (!text) return null;
  if (TRUE_VALUES.includes(text)) return true;
  if (FALSE_VALUES.includes(text)) return false;
  return 'invalid';
}

export type ParseResult = { bars: ParsedBars[]; errors: RowError[] };

export function parseBarsRows(rows: RawRow[], simulationId: string, validKeyActionIds: Set<string>): ParseResult {
  const errors: RowError[] = [];
  const err = (row: number, column: string, message: string) => errors.push({ row, column, message });
  const barsMap = new Map<string, ParsedBars>();
  const plainBarsRows = new Map<string, number>(); // BARS yang ditulis tanpa behaviour -> baris

  for (const { row, cells } of rows) {
    const errCount = errors.length;
    const keyActionId = cleanText(cells.key_action_id);
    const typeText = cleanText(cells.bars_type).toUpperCase();
    const barsNo = parseInteger(cells.bars_no);
    const barsName = cleanText(cells.bars_name);
    const behaviour = cleanText(cells.behaviour);
    const behaviourNo = parseInteger(cells.behaviour_no);
    const weight = parseInteger(cells.weight);
    const needAi = parseBoolean(cells.need_ai);

    if (!keyActionId) err(row, 'key_action_id', 'Wajib diisi');
    else if (!validKeyActionIds.has(keyActionId)) err(row, 'key_action_id', `Key action "${keyActionId}" tidak ada di master`);
    if (!typeText) err(row, 'bars_type', 'Wajib diisi');
    else if (!(BARS_TYPES as readonly string[]).includes(typeText)) err(row, 'bars_type', 'Harus POSITIVE, NETRAL, atau NEGATIVE');
    if (barsNo === null) err(row, 'bars_no', 'Wajib diisi');
    else if (barsNo === 'invalid' || barsNo < 1) err(row, 'bars_no', 'Harus bilangan bulat ≥ 1');
    if (!barsName) err(row, 'bars_name', 'Wajib diisi');
    if (behaviour) {
      if (behaviourNo === null) err(row, 'behaviour_no', 'Wajib diisi bila behaviour diisi');
      else if (behaviourNo === 'invalid' || behaviourNo < 1) err(row, 'behaviour_no', 'Harus bilangan bulat ≥ 1');
    } else if (behaviourNo !== null) {
      err(row, 'behaviour', 'Wajib diisi bila behaviour_no diisi');
    }
    if (weight === 'invalid' || (typeof weight === 'number' && weight < 1)) err(row, 'weight', 'Harus bilangan bulat ≥ 1');
    if (needAi === 'invalid') err(row, 'need_ai', 'Harus TRUE/FALSE, 1/0, atau YA/TIDAK');
    if (errors.length > errCount) continue;

    const type = typeText as BarsType;
    const barsId = barsIdOf(keyActionId, type, simulationId, barsNo as number);
    if (barsId.length > MAX_ID_LENGTH) {
      err(row, 'key_action_id', `ID BARS "${barsId}" melebihi ${MAX_ID_LENGTH} karakter`);
      continue;
    }
    const needAiValue = needAi === null ? true : (needAi as boolean);

    let bars = barsMap.get(barsId);
    if (!bars) {
      bars = { bars_id: barsId, key_action_id: keyActionId, bars_type: type, bars_no: barsNo as number, bars_name: barsName, need_ai: needAiValue, row, behaviours: [] };
      barsMap.set(barsId, bars);
    } else {
      const label = `${keyActionId} ${type} no ${barsNo} (baris ${bars.row})`;
      if (bars.bars_name !== barsName) {
        err(row, 'bars_name', `Berbeda dengan bars_name BARS yang sama: ${label}`);
        continue;
      }
      if (cleanText(cells.need_ai) && bars.need_ai !== needAiValue) {
        err(row, 'need_ai', `Berbeda dengan need_ai BARS yang sama: ${label}`);
        continue;
      }
    }

    if (!behaviour) {
      if (plainBarsRows.has(barsId)) err(row, 'bars_no', `BARS ganda (sudah ada di baris ${plainBarsRows.get(barsId)})`);
      else if (bars.behaviours.length) err(row, 'behaviour', 'BARS ini sudah punya behaviour di baris lain; baris tanpa behaviour tidak boleh dicampur');
      else plainBarsRows.set(barsId, row);
      continue;
    }
    if (plainBarsRows.has(barsId)) {
      err(row, 'behaviour', `BARS ini sudah ditulis tanpa behaviour di baris ${plainBarsRows.get(barsId)}; tidak boleh dicampur`);
      continue;
    }
    const dup = bars.behaviours.find((b) => b.behaviour_no === behaviourNo);
    if (dup) {
      err(row, 'behaviour_no', `behaviour_no ${behaviourNo} ganda (sudah ada di baris ${dup.row})`);
      continue;
    }
    const behaviourId = behaviourIdOf(barsId, behaviourNo as number);
    if (behaviourId.length > MAX_ID_LENGTH) {
      err(row, 'behaviour_no', `ID behaviour "${behaviourId}" melebihi ${MAX_ID_LENGTH} karakter`);
      continue;
    }
    bars.behaviours.push({
      bars_behaviour_id: behaviourId,
      behaviour_no: behaviourNo as number,
      bars_behaviour: behaviour,
      weight: weight === null ? DEFAULT_WEIGHT : (weight as number),
      row,
    });
  }

  return { bars: [...barsMap.values()], errors };
}

// Format matriks: kolom key_action_id membuka blok key action (kosong = lanjutan blok di atasnya);
// kolom {TIPE} membuka BARS baru; kolom "{TIPE} behaviour" menempel ke BARS terakhir tipe itu
// (boleh di baris yang sama atau di bawahnya). Nomor urut dari urutan baris.
export function parseMatrixRows(rows: MatrixRawRow[], simulationId: string, validKeyActionIds: Set<string>): ParseResult {
  const errors: RowError[] = [];
  const err = (row: number, column: string, message: string) => errors.push({ row, column, message });
  const result: ParsedBars[] = [];
  const seenKeyActions = new Map<string, number>(); // lower(key_action_id) -> baris
  // Blok aktif; null = belum ada blok, 'skip' = blok key action tidak valid (barisnya dilewati)
  let block: { keyActionId: string; bars: Record<BarsType, ParsedBars[]> } | 'skip' | null = null;

  for (const r of rows) {
    const keyActionId = cleanText(r.key_action_id);
    if (keyActionId) {
      const prev = seenKeyActions.get(keyActionId.toLowerCase());
      if (prev !== undefined) {
        err(r.row, MATRIX_KEY_COLUMN, `Key action "${keyActionId}" sudah ditulis di baris ${prev}; satukan dalam 1 blok`);
        block = 'skip';
      } else if (!validKeyActionIds.has(keyActionId)) {
        err(r.row, MATRIX_KEY_COLUMN, `Key action "${keyActionId}" tidak ada di master`);
        seenKeyActions.set(keyActionId.toLowerCase(), r.row);
        block = 'skip';
      } else {
        seenKeyActions.set(keyActionId.toLowerCase(), r.row);
        block = { keyActionId, bars: { POSITIVE: [], NETRAL: [], NEGATIVE: [] } };
      }
    } else if (block === null) {
      err(r.row, MATRIX_KEY_COLUMN, 'Wajib diisi di baris pertama blok key action');
      block = 'skip';
    }
    if (block === 'skip') continue;

    for (const type of BARS_TYPES) {
      const barsName = cleanText(r.bars[type]);
      const behaviour = cleanText(r.behaviours[type]);
      const list = block.bars[type];
      if (barsName) {
        const barsNo = list.length + 1;
        const barsId = barsIdOf(block.keyActionId, type, simulationId, barsNo);
        if (barsId.length > MAX_ID_LENGTH) {
          err(r.row, type, `ID BARS "${barsId}" melebihi ${MAX_ID_LENGTH} karakter`);
          continue;
        }
        const bars: ParsedBars = {
          bars_id: barsId, key_action_id: block.keyActionId, bars_type: type, bars_no: barsNo,
          bars_name: barsName, need_ai: true, row: r.row, behaviours: [],
        };
        list.push(bars);
        result.push(bars);
      }
      if (!behaviour) continue;
      const bars = list[list.length - 1];
      if (!bars) {
        err(r.row, matrixBehaviourColumn(type), `Behaviour belum punya BARS ${type} di atasnya (isi kolom ${type} dulu)`);
        continue;
      }
      const behaviourNo = bars.behaviours.length + 1;
      const behaviourId = behaviourIdOf(bars.bars_id, behaviourNo);
      if (behaviourId.length > MAX_ID_LENGTH) {
        err(r.row, matrixBehaviourColumn(type), `ID behaviour "${behaviourId}" melebihi ${MAX_ID_LENGTH} karakter`);
        continue;
      }
      bars.behaviours.push({ bars_behaviour_id: behaviourId, behaviour_no: behaviourNo, bars_behaviour: behaviour, weight: DEFAULT_WEIGHT, row: r.row });
    }
  }
  return { bars: result, errors };
}
