// Import BARS (PRD_Import_BARS.md): tipe respons API + helper murni (diuji Vitest).

export const BARS_TYPES = ['POSITIVE', 'NETRAL', 'NEGATIVE'] as const;
export type BarsType = (typeof BARS_TYPES)[number];

export type Counts = { new: number; changed: number; unchanged: number; deleted: number };

export type ImportSummary = {
  bars: Record<BarsType, Counts> & { total: Counts };
  behaviours: Counts;
};

export type RowError = { row: number | null; column: string | null; message: string };

export type ImportResult = {
  simulation_id: string;
  simulation_name?: string | null;
  rows_read: number;
  valid: boolean;
  summary: ImportSummary;
  errors: RowError[];
  error_total: number;
  warnings: string[];
};

export type CurrentSummary = {
  simulation_id: string;
  bars: Record<BarsType, number>;
  bars_total: number;
  behaviours: number;
};

export const MAX_XLSX_BYTES = 5 * 1024 * 1024;

// Validasi klien (server tetap yang menentukan)
export function checkXlsxFile(file: File): string | null {
  if (!/\.xlsx$/i.test(file.name)) return 'File harus berformat .xlsx';
  if (file.size === 0) return 'File kosong';
  if (file.size > MAX_XLSX_BYTES) return 'Ukuran file maksimal 5 MB';
  return null;
}

// Nama file unduhan dibentuk di klien (Content-Disposition tidak terbaca lewat CORS)
export function exportFileName(simulationId: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `BARS_${simulationId}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;
}
export const TEMPLATE_FILE_NAME = 'BARS_template.xlsx';

// Error 400 dari POST /import membawa daftar error yang sama dengan preview
export function importErrorsFrom(data: unknown): { errors: RowError[]; error_total: number } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { errors?: unknown; error_total?: unknown };
  if (!Array.isArray(d.errors)) return null;
  return { errors: d.errors as RowError[], error_total: typeof d.error_total === 'number' ? d.error_total : d.errors.length };
}

export const hasChanges = (s: ImportSummary) =>
  s.bars.total.new + s.bars.total.changed + s.bars.total.deleted + s.behaviours.new + s.behaviours.changed + s.behaviours.deleted > 0;
