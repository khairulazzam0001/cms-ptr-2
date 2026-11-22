// Format file Excel Import BARS (PRD_Import_BARS.md §5).

export const BARS_TYPES = ['POSITIVE', 'NETRAL', 'NEGATIVE'] as const;
export type BarsType = (typeof BARS_TYPES)[number];

export const SHEET_BARS = 'BARS';
export const SHEET_INFO = 'Info';
export const SHEET_REFERENSI = 'Referensi';
export const SHEET_PETUNJUK = 'Petunjuk';

// Urutan kolom sheet BARS (template & export)
export const COLUMNS = [
  'key_action_id',
  'bars_type',
  'bars_no',
  'bars_name',
  'behaviour_no',
  'behaviour',
  'weight',
  'need_ai',
] as const;
export type ColumnName = (typeof COLUMNS)[number];
export const REQUIRED_COLUMNS: ColumnName[] = ['key_action_id', 'bars_type', 'bars_no', 'bars_name'];

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;
export const MAX_ERRORS_SHOWN = 200;
export const MAX_ID_LENGTH = 50; // varchar(50)
export const DEFAULT_WEIGHT = 1;

// Pola ID mengikuti data yang ada, mis. CI1-NEGATIVE-bottleneck-1 (PRD §6)
export const barsIdOf = (keyActionId: string, type: BarsType, simulationId: string, barsNo: number) =>
  `${keyActionId}-${type}-${simulationId}-${barsNo}`;
export const behaviourIdOf = (barsId: string, behaviourNo: number) => `${barsId}-${behaviourNo}`;

// Nilai mentah satu baris (sudah dinormalisasi dari sel Excel)
export type RawCell = string | number | boolean | null;
export type RawRow = { row: number; cells: Partial<Record<ColumnName, RawCell>> };

export type RowError = { row: number | null; column: string | null; message: string };

export type ParsedBehaviour = {
  bars_behaviour_id: string;
  behaviour_no: number;
  bars_behaviour: string;
  weight: number;
  row: number;
};

export type ParsedBars = {
  bars_id: string;
  key_action_id: string;
  bars_type: BarsType;
  bars_no: number;
  bars_name: string;
  need_ai: boolean;
  row: number;
  behaviours: ParsedBehaviour[];
};
