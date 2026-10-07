// Geometri halaman A4 portrait (PRD Document Generator FR-20). Semua hitungan dalam px CSS @96 dpi.
export const PX_PER_MM = 96 / 25.4;
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 25.4;

export const PAGE_HEIGHT = PAGE_HEIGHT_MM * PX_PER_MM; // ~1122.5
export const PAGE_MARGIN = PAGE_MARGIN_MM * PX_PER_MM; // 96
export const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * PAGE_MARGIN; // ~930.5 (246,2 mm)
export const PAGE_GAP = 24; // jarak antar lembar di editor

export const FONT_SIZES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
export const DEFAULT_FONT_SIZE_PT = 11;
export const MAX_PAGES = 200;
export const MAX_TABLE_ROWS = 20;
export const MAX_TABLE_COLS = 10;
export const PAGINATE_DEBOUNCE_MS = 150;

export const TEXT_COLORS = [
  '#000000', '#4b5563', '#9ca3af', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#0d9488', '#2563eb', '#4f46e5', '#9333ea', '#db2777',
];
