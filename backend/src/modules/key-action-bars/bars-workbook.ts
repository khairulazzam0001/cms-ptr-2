// Baca & tulis workbook .xlsx (exceljs) untuk Import BARS (PRD_Import_BARS.md §5, §7.2).
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { extname } from 'path';
import {
  COLUMNS,
  ColumnName,
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
  rows: RawRow[];
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

  // Header baris 1 -> indeks kolom
  const colIndex = new Map<ColumnName, number>();
  const unknownColumns: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    const name = String(cellToPrimitive(cell.value) ?? '').trim().toLowerCase();
    if (!name) return;
    if ((COLUMNS as readonly string[]).includes(name)) colIndex.set(name as ColumnName, col);
    else unknownColumns.push(name);
  });
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

  let infoSimulationId: string | null = null;
  const info = findSheet(SHEET_INFO);
  info?.eachRow((row) => {
    const key = String(cellToPrimitive(row.getCell(1).value) ?? '').trim().toLowerCase();
    if (key === 'simulation_id') infoSimulationId = String(cellToPrimitive(row.getCell(2).value) ?? '').trim() || null;
  });

  return { rows, infoSimulationId, unknownColumns };
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

export async function writeBarsWorkbook(opts: {
  simulation: { simulation_id: string; simulation_name?: string | null } | null;
  rows: ExportRow[];
  keyActions: ReferenceKeyAction[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CMS Data Master';

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
  help.columns = [{ width: 16 }, { width: 100 }];
  help.addRows([
    ['Petunjuk Import BARS'],
    [],
    ['Aturan umum', '1 baris = 1 behaviour. BARS dengan beberapa behaviour ditulis di beberapa baris dengan kolom BARS diulang.'],
    ['', 'Isi file menggantikan seluruh BARS & behaviour simulation terpilih. Data yang tidak ada di file akan dihapus (soft delete).'],
    ['', 'Simulation dipilih di halaman Import BARS, bukan ditulis di file. Sheet Info dipakai untuk mencegah salah upload.'],
    [],
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
  ]);
  help.getRow(1).font = { bold: true, size: 14 };
  help.getColumn(1).font = { bold: true };
  help.getColumn(2).alignment = { wrapText: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
