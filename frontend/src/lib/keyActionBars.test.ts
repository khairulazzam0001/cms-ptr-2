import { describe, expect, it } from 'vitest';
import { checkXlsxFile, exportFileName, hasChanges, importErrorsFrom, ImportSummary, templateFileName } from './keyActionBars';

const f = (name: string, size: number) => new File([new Uint8Array(size)], name);
const zero = { new: 0, changed: 0, unchanged: 0, deleted: 0 };
const summary = (over: Partial<ImportSummary> = {}): ImportSummary => ({
  bars: { POSITIVE: zero, NETRAL: zero, NEGATIVE: zero, total: { ...zero, unchanged: 3 } },
  behaviours: { ...zero, unchanged: 2 },
  ...over,
});

describe('keyActionBars helpers', () => {
  it('checkXlsxFile: hanya .xlsx, tidak kosong, maks 5 MB', () => {
    expect(checkXlsxFile(f('BARS.xlsx', 10))).toBeNull();
    expect(checkXlsxFile(f('BARS.XLSX', 10))).toBeNull();
    expect(checkXlsxFile(f('data.xls', 10))).toBe('File harus berformat .xlsx');
    expect(checkXlsxFile(f('data.csv', 10))).toBe('File harus berformat .xlsx');
    expect(checkXlsxFile(f('BARS.xlsx', 0))).toBe('File kosong');
    expect(checkXlsxFile(f('BARS.xlsx', 5 * 1024 * 1024 + 1))).toBe('Ukuran file maksimal 5 MB');
  });

  it('exportFileName: BARS_{simulation}_{yyyymmdd}.xlsx', () => {
    expect(exportFileName('bottleneck', new Date(2026, 10, 5))).toBe('BARS_bottleneck_20261105.xlsx');
    expect(exportFileName('bottleneck', new Date(2026, 10, 5), 'flat')).toBe('BARS_bottleneck_20261105_flat.xlsx');
  });

  it('templateFileName: matriks default, flat diberi akhiran', () => {
    expect(templateFileName()).toBe('BARS_template.xlsx');
    expect(templateFileName('flat')).toBe('BARS_template_flat.xlsx');
  });

  it('importErrorsFrom: mengambil daftar error dari respons 400', () => {
    expect(importErrorsFrom({ message: 'File tidak valid', errors: [{ row: 2, column: 'bars_type', message: 'x' }], error_total: 5 })).toEqual({
      errors: [{ row: 2, column: 'bars_type', message: 'x' }],
      error_total: 5,
    });
    expect(importErrorsFrom({ message: 'Sheet "BARS" tidak ditemukan' })).toBeNull();
    expect(importErrorsFrom(null)).toBeNull();
  });

  it('hasChanges: false bila semua tidak berubah', () => {
    expect(hasChanges(summary())).toBe(false);
    expect(hasChanges(summary({ behaviours: { ...zero, deleted: 1 } }))).toBe(true);
  });
});
