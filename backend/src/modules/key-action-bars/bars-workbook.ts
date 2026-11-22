// Baca & tulis workbook .xlsx (exceljs) untuk Import BARS (PRD_Import_BARS.md §5, §7.2).
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { extname } from 'path';
import {
  BARS_TYPES,
  BarsType,
  COLUMNS,
  ColumnName,
  FileFormat,
  MATRIX_COLUMNS,
  MATRIX_KEY_COLUMN,
  MatrixRawRow,
  matrixBehaviourColumn,
  MAX_DATA_ROWS,
  MAX_FILE_BYTES,
  REQUIRED_COLUMNS,
  RawCell,
  RawRow,
  SHEET_BARS,
  SHEET_INFO,
  SHEET_PETUNJUK,
  SHEET_REFERENSI,
} from './bars-format';

export type UploadedXlsx = { originalname: string; size: number; buffer: Buffer };

export type ReadWorkbookResult = {
  format: FileFormat;
  rows: RawRow[]; // format flat
  matrixRows: MatrixRawRow[]; // format matriks
  infoSimulationId: string | null;
  unknownColumns: string[];
};

// Nilai sel exceljs -> primitif (formula dibaca hasilnya, rich text digabung)
export function cellToPrimitive(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellToPrimitive((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
    if ('text' in value) return String((value as ExcelJS.CellHyperlinkValue).text);
    if ('error' in value) return null;
  }
  return String(value);
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export async function readBarsWorkbook(file: UploadedXlsx | undefined): Promise<ReadWorkbookResult> {
  if (!file) throw new BadRequestException('File wajib diisi');
  if (extname(file.originalname || '').toLowerCase() !== '.xlsx') throw new BadRequestException('File harus berformat .xlsx');
  if (file.size > MAX_FILE_BYTES) throw new PayloadTooLargeException('Ukuran file maksimal 5 MB');
  if (!file.buffer?.subarray(0, 4).equals(ZIP_MAGIC)) throw new BadRequestException('File bukan Excel .xlsx yang valid');

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException('File bukan Excel .xlsx yang valid');
  }
  const findSheet = (name: string) => wb.worksheets.find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
  const ws = findSheet(SHEET_BARS);
  if (!ws) throw new BadRequestException(`Sheet "${SHEET_BARS}" tidak ditemukan`);

  // Header baris 1 -> nama kolom (huruf kecil, spasi dirapikan) -> indeks
  const header = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const name = String(cellToPrimitive(cell.value) ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (name && !header.has(name)) header.set(name, col);
  });
  const infoSimulationId = readInfoSimulationId(findSheet(SHEET_INFO));

  // Format dikenali dari header: ada "bars_type" = flat; ada "positive" = matriks
  if (!header.has('bars_type') && header.has('positive')) {
    return { format: 'matrix', rows: [], matrixRows: readMatrixRows(ws, header), infoSimulationId, unknownColumns: [] };
  }
  if (!header.has('bars_type')) {
    throw new BadRequestException(
      `Header sheet ${SHEET_BARS} tidak dikenali. Format matriks: ${MATRIX_COLUMNS.join(', ')}. ` +
        `Format flat: ${COLUMNS.join(', ')}.`,
    );
  }

  const colIndex = new Map<ColumnName, number>();
  const unknownColumns: string[] = [];
  for (const [name, col] of header) {
    if ((COLUMNS as readonly string[]).includes(name)) colIndex.set(name as ColumnName, col);
    else unknownColumns.push(name);
  }
  const missing = REQUIRED_COLUMNS.filter((c) => !colIndex.has(c));
  if (missing.length) throw new BadRequestException(`Kolom wajib tidak ada di header sheet ${SHEET_BARS}: ${missing.join(', ')}`);

  const rows: RawRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: RawRow['cells'] = {};
    let filled = false;
    for (const [name, col] of colIndex) {
      const v = cellToPrimitive(row.getCell(col).value);
      if (v !== null && String(v).trim() !== '') filled = true;
      cells[name] = v;
    }
    if (!filled) continue; // baris kosong diabaikan
    rows.push({ row: r, cells });
    if (rows.length > MAX_DATA_ROWS) throw new BadRequestException(`Maksimal ${MAX_DATA_ROWS} baris data per file`);
  }

  return { format: 'flat', rows, matrixRows: [], infoSimulationId, unknownColumns };
}

function readInfoSimulationId(info: ExcelJS.Worksheet | undefined): string | null {
  let id: string | null = null;
  info?.eachRow((row) => {
    const key = String(cellToPrimitive(row.getCell(1).value) ?? '').trim().toLowerCase();
    if (key === 'simulation_id') id = String(cellToPrimitive(row.getCell(2).value) ?? '').trim() || null;
  });
  return id;
}

const isFilled = (v: RawCell) => v !== null && String(v).trim() !== '';

function readMatrixRows(ws: ExcelJS.Worksheet, header: Map<string, number>): MatrixRawRow[] {
  const missing = MATRIX_COLUMNS.filter((c) => !header.has(c.toLowerCase()));
  if (missing.length) throw new BadRequestException(`Kolom wajib tidak ada di header sheet ${SHEET_BARS}: ${missing.join(', ')}`);
  const col = (name: string) => header.get(name.toLowerCase()) as number;

  const rows: MatrixRawRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const value = (name: string) => cellToPrimitive(row.getCell(col(name)).value);
    const item: MatrixRawRow = { row: r, key_action_id: value(MATRIX_KEY_COLUMN), bars: {}, behaviours: {} };
    for (const t of BARS_TYPES) {
      item.bars[t] = value(t);
      item.behaviours[t] = value(matrixBehaviourColumn(t));
    }
    const filled = [item.key_action_id, ...Object.values(item.bars), ...Object.values(item.behaviours)].some((v) => isFilled(v ?? null));
    if (!filled) continue; // baris kosong diabaikan
    rows.push(item);
    if (rows.length > MAX_DATA_ROWS) throw new BadRequestException(`Maksimal ${MAX_DATA_ROWS} baris data per file`);
  }
  return rows;
}

// ---------- Tulis template / export ----------

export type ExportRow = {
  key_action_id: string;
  bars_type: string;
  bars_no: number;
  bars_name: string;
  behaviour_no: number | null;
  behaviour: string | null;
  weight: number | null;
  need_ai: boolean;
};

export type ReferenceKeyAction = { key_action_id: string; key_action_name: string; competency_id: string; competency_name: string };

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
const WIDTHS: Record<ColumnName, number> = {
  key_action_id: 16, bars_type: 13, bars_no: 9, bars_name: 50, behaviour_no: 13, behaviour: 60, weight: 9, need_ai: 10,
};

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell((c) => { c.fill = HEADER_FILL; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// Warna header per tipe, sama dengan halaman Key Action Matrix
const TYPE_FILL: Record<BarsType, string> = { POSITIVE: 'FF047857', NETRAL: 'FFF59E0B', NEGATIVE: 'FFB91C1C' };

// Susun baris export (urut key action -> tipe -> bars_no -> behaviour_no) menjadi blok matriks:
// per key action, tiap tipe = daftar baris [nama BARS] lalu [behaviour] di bawahnya.
export function toMatrixRows(rows: ExportRow[]): (string | null)[][] {
  type Bars = { no: number; name: string; behaviours: string[] };
  const blocks = new Map<string, Record<BarsType, Bars[]>>();
  for (const r of rows) {
    if (!(BARS_TYPES as readonly string[]).includes(r.bars_type)) continue;
    let block = blocks.get(r.key_action_id);
    if (!block) blocks.set(r.key_action_id, (block = { POSITIVE: [], NETRAL: [], NEGATIVE: [] }));
    const list = block[r.bars_type as BarsType];
    let bars = list[list.length - 1];
    if (!bars || bars.no !== r.bars_no) {
      bars = { no: r.bars_no, name: r.bars_name, behaviours: [] };
      list.push(bars);
    }
    if (r.behaviour) bars.behaviours.push(r.behaviour);
  }

  const out: (string | null)[][] = [];
  for (const [keyActionId, block] of blocks) {
    // tiap tipe -> urutan sel [kolom BARS, kolom behaviour] per baris
    const lines = BARS_TYPES.map((t) =>
      block[t].flatMap((b) => [[b.name, null] as const, ...b.behaviours.map((h) => [null, h] as const)]),
    );
    const height = Math.max(1, ...lines.map((l) => l.length));
    for (let i = 0; i < height; i++) {
      out.push([i === 0 ? keyActionId : null, ...lines.flatMap((l) => (l[i] ? [l[i][0], l[i][1]] : [null, null]))]);
    }
  }
  return out;
}

function writeMatrixSheet(wb: ExcelJS.Workbook, rows: ExportRow[]) {
  const ws = wb.addWorksheet(SHEET_BARS);
  ws.columns = MATRIX_COLUMNS.map((c) => ({ header: c, key: c, width: c === MATRIX_KEY_COLUMN ? 16 : c.endsWith('behaviour') ? 55 : 40 }));
  styleHeader(ws);
  BARS_TYPES.forEach((t) => {
    const fill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TYPE_FILL[t] } };
    ws.getCell(1, MATRIX_COLUMNS.indexOf(t) + 1).fill = fill;
    ws.getCell(1, MATRIX_COLUMNS.indexOf(matrixBehaviourColumn(t)) + 1).fill = fill;
  });
  ws.addRows(toMatrixRows(rows));
  for (let c = 2; c <= MATRIX_COLUMNS.length; c++) ws.getColumn(c).alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn(1).alignment = { vertical: 'top' };
  ws.getColumn(1).font = { bold: true };
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
}

export async function writeBarsWorkbook(opts: {
  simulation: { simulation_id: string; simulation_name?: string | null } | null;
  rows: ExportRow[];
  keyActions: ReferenceKeyAction[];
  format?: FileFormat;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CMS Data Master';
  const format = opts.format ?? 'matrix';
  if (format === 'matrix') writeMatrixSheet(wb, opts.rows);
  else writeFlatSheet(wb, opts.rows);
  writeCommonSheets(wb, opts, format);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function writeFlatSheet(wb: ExcelJS.Workbook, rows: ExportRow[]) {
  const opts = { rows };
  // Sheet BARS
  const ws = wb.addWorksheet(SHEET_BARS);
  ws.columns = COLUMNS.map((c) => ({ header: c, key: c, width: WIDTHS[c] }));
  styleHeader(ws);
  for (const r of opts.rows) {
    ws.addRow({ ...r, need_ai: r.need_ai ? 'TRUE' : 'FALSE' });
  }
  ws.getColumn('bars_name').alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn('behaviour').alignment = { wrapText: true, vertical: 'top' };
  // Dropdown di kolom bars_type & need_ai. Validasi rentang ada di runtime exceljs tetapi tidak di typing-nya.
  const lastRow = Math.max(opts.rows.length + 1, MAX_DATA_ROWS + 1);
  const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations;
  const columnRange = (name: ColumnName) => {
    const letter = String.fromCharCode(65 + COLUMNS.indexOf(name));
    return `${letter}2:${letter}${lastRow}`;
  };
  validations.add(columnRange('bars_type'), {
    type: 'list', allowBlank: true, formulae: ['"POSITIVE,NETRAL,NEGATIVE"'],
    showErrorMessage: true, errorTitle: 'bars_type', error: 'Pilih POSITIVE, NETRAL, atau NEGATIVE',
  });
  validations.add(columnRange('need_ai'), { type: 'list', allowBlank: true, formulae: ['"TRUE,FALSE"'] });
}

function writeCommonSheets(
  wb: ExcelJS.Workbook,
  opts: { simulation: { simulation_id: string; simulation_name?: string | null } | null; keyActions: ReferenceKeyAction[] },
  format: FileFormat,
) {
  // Sheet Info (simulation asal file, dicek saat import)
  const info = wb.addWorksheet(SHEET_INFO);
  info.columns = [{ width: 18 }, { width: 45 }];
  info.addRows([
    ['simulation_id', opts.simulation?.simulation_id ?? ''],
    ['simulation_name', opts.simulation?.simulation_name ?? ''],
    ['dibuat', new Date().toISOString()],
  ]);
  info.getColumn(1).font = { bold: true };

  // Sheet Referensi (key action valid)
  const ref = wb.addWorksheet(SHEET_REFERENSI);
  ref.columns = [
    { header: 'key_action_id', key: 'key_action_id', width: 16 },
    { header: 'key_action_name', key: 'key_action_name', width: 45 },
    { header: 'competency_id', key: 'competency_id', width: 18 },
    { header: 'competency_name', key: 'competency_name', width: 35 },
  ];
  styleHeader(ref);
  opts.keyActions.forEach((k) => ref.addRow(k));

  // Sheet Petunjuk (contoh ditaruh di sini agar tidak ikut ter-import)
  const help = wb.addWorksheet(SHEET_PETUNJUK);
  help.columns = [{ width: 30 }, { width: 100 }];
  help.addRows([
    [format === 'matrix' ? 'Petunjuk Import BARS — format matriks' : 'Petunjuk Import BARS — format flat'],
    [],
    ['Aturan umum', 'Isi file menggantikan seluruh BARS & behaviour simulation terpilih. Data yang tidak ada di file akan dihapus (soft delete).'],
    ['', 'Simulation dipilih di halaman Import BARS, bukan ditulis di file. Sheet Info dipakai untuk mencegah salah upload.'],
    ['', 'Sistem mengenali format dari judul kolom baris 1 sheet BARS (matriks atau flat). Jangan ubah judul kolom.'],
    [],
    ...(format === 'matrix' ? MATRIX_HELP : FLAT_HELP),
  ]);
  help.getRow(1).font = { bold: true, size: 14 };
  help.getColumn(1).font = { bold: true };
  help.getColumn(2).alignment = { wrapText: true };
}

const MATRIX_HELP: string[][] = [
  ['key_action_id', 'Diisi di baris pertama blok key action (harus ada di sheet Referensi). Baris di bawahnya yang kolom ini kosong masih milik key action yang sama. 1 key action = 1 blok.'],
  ['POSITIVE / NETRAL / NEGATIVE', 'Nama BARS. Setiap sel yang diisi membuat BARS baru; nomor BARS mengikuti urutan baris (1, 2, ...).'],
  ['... behaviour', 'Behaviour milik BARS terakhir di kolom tipe yang sama (boleh di baris yang sama atau di bawahnya); nomor mengikuti urutan baris.'],
  ['', 'BARS tanpa behaviour boleh. Behaviour tanpa BARS di atasnya = error.'],
  ['weight / need_ai', 'Tidak ada di format ini: weight selalu 1, need_ai selalu TRUE. Pakai format flat bila perlu nilai lain.'],
  ['Perhatian', 'Urutan baris menentukan nomor & ID. Jangan sort/filter sheet BARS; menyisipkan BARS di tengah menggeser nomor BARS di bawahnya.'],
  [],
  ['Contoh', 'key_action_id | POSITIVE | POSITIVE behaviour | NETRAL | NETRAL behaviour | NEGATIVE | NEGATIVE behaviour'],
  ['', 'BA1 | BARS positif 1 |  | BARS netral 1 |  | BARS negatif 1 | '],
  ['', ' |  | Behaviour positif 1.1 |  | Behaviour netral 1.1 |  | Behaviour negatif 1.1'],
  ['', ' |  | Behaviour positif 1.2 |  |  |  | '],
  ['', ' | BARS positif 2 | Behaviour positif 2.1 |  |  |  | '],
];

const FLAT_HELP: string[][] = [
  ['Aturan', '1 baris = 1 behaviour. BARS dengan beberapa behaviour ditulis di beberapa baris dengan kolom BARS diulang.'],
  ['key_action_id', 'Wajib. Harus ada di sheet Referensi.'],
  ['bars_type', 'Wajib. POSITIVE, NETRAL, atau NEGATIVE.'],
  ['bars_no', 'Wajib. Bilangan bulat ≥ 1, urutan BARS dalam key action + tipe yang sama.'],
  ['bars_name', 'Wajib. Harus sama di semua baris milik BARS yang sama.'],
  ['behaviour_no', 'Wajib bila behaviour diisi. Bilangan bulat ≥ 1, unik dalam satu BARS.'],
  ['behaviour', 'Opsional. Kosongkan untuk BARS tanpa behaviour (cukup 1 baris).'],
  ['weight', 'Opsional. Bilangan bulat ≥ 1. Kosong = 1.'],
  ['need_ai', 'Opsional. TRUE/FALSE (atau 1/0, YA/TIDAK). Kosong = TRUE.'],
  [],
  ['Contoh', 'key_action_id | bars_type | bars_no | bars_name | behaviour_no | behaviour | weight | need_ai'],
  ['', 'CI1 | POSITIVE | 1 | Menemukan permasalahan secara utuh dari data | 1 | Membaca seluruh data yang tersedia |  | TRUE'],
  ['', 'CI1 | POSITIVE | 1 | Menemukan permasalahan secara utuh dari data | 2 | Menyimpulkan akar masalah | 2 | TRUE'],
  ['', 'CI1 | NEGATIVE | 1 | Keliru dalam mengidentifikasi masalah |  |  |  | '],
];
