import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { parseBarsRows } from './bars-parser';
import { ExportRow, readBarsWorkbook, writeBarsWorkbook } from './bars-workbook';

const asFile = (buffer: Buffer, originalname = 'BARS.xlsx') => ({ originalname, size: buffer.length, buffer });
const KEY_ACTIONS = [{ key_action_id: 'CI1', key_action_name: 'Mengenali peluang', competency_id: 'COMP_DDI_CI', competency_name: 'Continuous Improvement' }];
const SIM = { simulation_id: 'bottleneck', simulation_name: 'Bottleneck' };

const ROWS: ExportRow[] = [
  { key_action_id: 'CI1', bars_type: 'POSITIVE', bars_no: 1, bars_name: 'Menemukan masalah', behaviour_no: 1, behaviour: 'Membaca data', weight: 2, need_ai: true },
  { key_action_id: 'CI1', bars_type: 'POSITIVE', bars_no: 1, bars_name: 'Menemukan masalah', behaviour_no: 2, behaviour: 'Menyimpulkan', weight: null, need_ai: true },
  { key_action_id: 'CI1', bars_type: 'NEGATIVE', bars_no: 1, bars_name: 'Keliru', behaviour_no: null, behaviour: null, weight: null, need_ai: false },
];

describe('bars workbook', () => {
  it('round-trip: export -> baca -> parse menghasilkan data yang sama (FR-IB-13)', async () => {
    const buf = await writeBarsWorkbook({ simulation: SIM, rows: ROWS, keyActions: KEY_ACTIONS });
    const read = await readBarsWorkbook(asFile(buf));
    expect(read.infoSimulationId).toBe('bottleneck');
    expect(read.unknownColumns).toEqual([]);
    expect(read.rows.map((r) => r.row)).toEqual([2, 3, 4]);
    const { bars, errors } = parseBarsRows(read.rows, 'bottleneck', new Set(['CI1']));
    expect(errors).toEqual([]);
    expect(bars.map((b) => [b.bars_id, b.bars_name, b.need_ai, b.behaviours.map((h) => [h.behaviour_no, h.bars_behaviour, h.weight])])).toEqual([
      ['CI1-POSITIVE-bottleneck-1', 'Menemukan masalah', true, [[1, 'Membaca data', 2], [2, 'Menyimpulkan', 1]]],
      ['CI1-NEGATIVE-bottleneck-1', 'Keliru', false, []],
    ]);
  });

  it('template: sheet BARS hanya header, Referensi berisi key action, Info kosong bila tanpa simulation', async () => {
    const buf = await writeBarsWorkbook({ simulation: null, rows: [], keyActions: KEY_ACTIONS });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['BARS', 'Info', 'Referensi', 'Petunjuk']);
    expect(wb.getWorksheet('BARS')!.actualRowCount).toBe(1);
    expect(wb.getWorksheet('Referensi')!.getRow(2).getCell(1).value).toBe('CI1');
    const read = await readBarsWorkbook(asFile(buf));
    expect(read.rows).toEqual([]);
    expect(read.infoSimulationId).toBeNull();
  });

  it('formula dibaca nilai hasilnya, kolom tak dikenal dilaporkan, baris kosong dilewati', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('bars'); // nama sheet tidak peka huruf besar
    ws.addRow(['key_action_id', 'bars_type', 'bars_no', 'bars_name', 'catatan']);
    ws.addRow(['CI1', 'POSITIVE', { formula: '1+0', result: 1 }, { richText: [{ text: 'Nama ' }, { text: 'BARS' }] }, 'x']);
    ws.addRow([]);
    ws.addRow(['CI1', 'NETRAL', 1, 'B']);
    const read = await readBarsWorkbook(asFile(Buffer.from(await wb.xlsx.writeBuffer())));
    expect(read.unknownColumns).toEqual(['catatan']);
    expect(read.rows.map((r) => [r.row, r.cells.bars_no, r.cells.bars_name])).toEqual([[2, 1, 'Nama BARS'], [4, 1, 'B']]);
  });

  it('menolak file tidak valid (AC-IB-11)', async () => {
    await expect(readBarsWorkbook(undefined)).rejects.toThrow('File wajib diisi');
    await expect(readBarsWorkbook(asFile(Buffer.from('a,b'), 'data.csv'))).rejects.toThrow('File harus berformat .xlsx');
    await expect(readBarsWorkbook(asFile(Buffer.from('%PDF-1.7 bukan excel'), 'palsu.xlsx'))).rejects.toThrow('File bukan Excel .xlsx yang valid');
    await expect(readBarsWorkbook({ originalname: 'besar.xlsx', size: 6 * 1024 * 1024, buffer: Buffer.alloc(0) })).rejects.toThrow(PayloadTooLargeException);
  });

  it('menolak bila sheet BARS atau kolom wajib tidak ada', async () => {
    const noSheet = new ExcelJS.Workbook();
    noSheet.addWorksheet('Data').addRow(['x']);
    await expect(readBarsWorkbook(asFile(Buffer.from(await noSheet.xlsx.writeBuffer())))).rejects.toThrow('Sheet "BARS" tidak ditemukan');
    const noCol = new ExcelJS.Workbook();
    noCol.addWorksheet('BARS').addRow(['key_action_id', 'bars_type']);
    await expect(readBarsWorkbook(asFile(Buffer.from(await noCol.xlsx.writeBuffer())))).rejects.toThrow(BadRequestException);
  });
});
