import { ParsedBars } from './bars-format';
import { ExistingBars, ExistingBehaviour, planImport } from './bars-diff';

const parsedBars = (over: Partial<ParsedBars> = {}): ParsedBars => ({
  bars_id: 'CI1-POSITIVE-sim-1',
  key_action_id: 'CI1',
  bars_type: 'POSITIVE',
  bars_no: 1,
  bars_name: 'BARS 1',
  need_ai: true,
  row: 2,
  behaviours: [{ bars_behaviour_id: 'CI1-POSITIVE-sim-1-1', behaviour_no: 1, bars_behaviour: 'Beh 1', weight: 1, row: 2 }],
  ...over,
});
const oldBars = (over: Partial<ExistingBars> = {}): ExistingBars => ({
  bars_id: 'CI1-POSITIVE-sim-1', bars_type: 'POSITIVE', bars_name: 'BARS 1', need_ai: true, sort_order: 1, is_deleted: false, ...over,
});
const oldBeh = (over: Partial<ExistingBehaviour> = {}): ExistingBehaviour => ({
  bars_behaviour_id: 'CI1-POSITIVE-sim-1-1', bars_id: 'CI1-POSITIVE-sim-1', bars_behaviour: 'Beh 1', weight: 1, sort_order: 1, is_deleted: false, ...over,
});

describe('planImport (mode ganti per simulation)', () => {
  it('data kosong -> semua baru', () => {
    const p = planImport([parsedBars()], [], []);
    expect(p.barsInsert).toHaveLength(1);
    expect(p.behaviourInsert[0]).toMatchObject({ bars_id: 'CI1-POSITIVE-sim-1', key_action_id: 'CI1' });
    expect(p.summary.bars.POSITIVE).toEqual({ new: 1, changed: 0, unchanged: 0, deleted: 0 });
    expect(p.summary.behaviours.new).toBe(1);
  });

  it('isi sama -> tidak ada perubahan (round-trip, AC-IB-02); weight NULL lama dianggap 1', () => {
    const p = planImport([parsedBars()], [oldBars()], [oldBeh({ weight: null })]);
    expect([p.barsInsert, p.barsUpdate, p.barsDelete, p.behaviourInsert, p.behaviourUpdate, p.behaviourDelete].map((x) => x.length)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(p.summary.bars.total.unchanged).toBe(1);
    expect(p.summary.behaviours.unchanged).toBe(1);
  });

  it('perubahan nama/need_ai/urutan & behaviour -> diubah', () => {
    const p = planImport([parsedBars({ bars_name: 'Baru', behaviours: [{ bars_behaviour_id: 'CI1-POSITIVE-sim-1-1', behaviour_no: 1, bars_behaviour: 'Beh 1', weight: 3, row: 2 }] })], [oldBars()], [oldBeh()]);
    expect(p.barsUpdate).toHaveLength(1);
    expect(p.behaviourUpdate).toHaveLength(1);
    expect(p.summary.bars.POSITIVE.changed).toBe(1);
    expect(p.summary.behaviours.changed).toBe(1);
  });

  it('ID yang pernah di-soft delete dihidupkan lagi (update, dihitung baru)', () => {
    const p = planImport([parsedBars()], [oldBars({ is_deleted: true })], [oldBeh({ is_deleted: true })]);
    expect(p.barsInsert).toHaveLength(0);
    expect(p.barsUpdate).toHaveLength(1);
    expect(p.behaviourUpdate).toHaveLength(1);
    expect(p.summary.bars.POSITIVE.new).toBe(1);
  });

  it('data aktif yang tidak ada di file -> soft delete; yang sudah terhapus tidak dihitung lagi (AC-IB-06)', () => {
    const p = planImport(
      [parsedBars({ behaviours: [] })],
      [oldBars(), oldBars({ bars_id: 'CI1-NEGATIVE-sim-1', bars_type: 'NEGATIVE' }), oldBars({ bars_id: 'CI2-NETRAL-sim-1', bars_type: 'NETRAL', is_deleted: true })],
      [oldBeh(), oldBeh({ bars_behaviour_id: 'CI1-NEGATIVE-sim-1-1', bars_id: 'CI1-NEGATIVE-sim-1' })],
    );
    expect(p.barsDelete).toEqual(['CI1-NEGATIVE-sim-1']);
    expect(p.behaviourDelete).toEqual(['CI1-POSITIVE-sim-1-1', 'CI1-NEGATIVE-sim-1-1']);
    expect(p.summary.bars.NEGATIVE.deleted).toBe(1);
    expect(p.summary.bars.NETRAL.deleted).toBe(0);
    expect(p.summary.behaviours.deleted).toBe(2);
  });
});
