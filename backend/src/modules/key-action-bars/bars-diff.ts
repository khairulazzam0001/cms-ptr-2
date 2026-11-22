// Rencana "ganti per simulation" (PRD_Import_BARS.md FR-IB-31): bandingkan isi file dengan data
// simulation di DB (termasuk yang sudah di-soft delete, agar ID yang sama dihidupkan lagi). Fungsi murni.
import { BARS_TYPES, BarsType, DEFAULT_WEIGHT, ParsedBars, ParsedBehaviour, behaviourIdOf } from './bars-format';

export type ExistingBars = {
  bars_id: string;
  bars_type?: string | null;
  bars_name?: string | null;
  need_ai: boolean;
  sort_order: number;
  is_deleted: boolean;
};

export type ExistingBehaviour = {
  bars_behaviour_id: string;
  bars_id: string;
  bars_behaviour?: string | null;
  weight?: number | null;
  sort_order: number;
  is_deleted: boolean;
};

export type Counts = { new: number; changed: number; unchanged: number; deleted: number };
const zero = (): Counts => ({ new: 0, changed: 0, unchanged: 0, deleted: 0 });

export type ImportSummary = {
  bars: Record<BarsType, Counts> & { total: Counts };
  behaviours: Counts;
};

export type ImportPlan = {
  barsInsert: ParsedBars[];
  barsUpdate: ParsedBars[]; // berubah atau dihidupkan lagi
  barsDelete: string[];
  behaviourInsert: (ParsedBehaviour & { bars_id: string; key_action_id: string })[];
  behaviourUpdate: (ParsedBehaviour & { bars_id: string; key_action_id: string })[];
  behaviourDelete: string[];
  summary: ImportSummary;
};

// Kolasi MySQL (utf8mb4_unicode_ci) tidak membedakan huruf besar/kecil, jadi ID dicocokkan dengan cara
// yang sama. ID yang sudah tersimpan dipakai apa adanya, mis. data lama "CI1-POSITIVE-BOTTLENECK-1"
// tetap cocok dengan ID file "CI1-POSITIVE-bottleneck-1" dan tidak dianggap baru + dihapus.
const idKey = (id: string) => id.toLowerCase();

function canonicalize(parsed: ParsedBars[], existingBars: ExistingBars[], existingBehaviours: ExistingBehaviour[]): ParsedBars[] {
  const barsIds = new Map(existingBars.map((b) => [idKey(b.bars_id), b.bars_id]));
  const behaviourIds = new Map(existingBehaviours.map((b) => [idKey(b.bars_behaviour_id), b.bars_behaviour_id]));
  return parsed.map((bars) => {
    const barsId = barsIds.get(idKey(bars.bars_id)) ?? bars.bars_id;
    return {
      ...bars,
      bars_id: barsId,
      // Behaviour baru di bawah BARS lama ikut memakai ID BARS yang tersimpan
      behaviours: bars.behaviours.map((h) => {
        const id = behaviourIdOf(barsId, h.behaviour_no);
        return { ...h, bars_behaviour_id: behaviourIds.get(idKey(id)) ?? id };
      }),
    };
  });
}

export function planImport(fileBars: ParsedBars[], existingBars: ExistingBars[], existingBehaviours: ExistingBehaviour[]): ImportPlan {
  const parsed = canonicalize(fileBars, existingBars, existingBehaviours);
  const plan: ImportPlan = {
    barsInsert: [],
    barsUpdate: [],
    barsDelete: [],
    behaviourInsert: [],
    behaviourUpdate: [],
    behaviourDelete: [],
    summary: {
      bars: { POSITIVE: zero(), NETRAL: zero(), NEGATIVE: zero(), total: zero() },
      behaviours: zero(),
    },
  };
  const count = (type: string | null | undefined, key: keyof Counts) => {
    if ((BARS_TYPES as readonly string[]).includes(type ?? '')) plan.summary.bars[type as BarsType][key]++;
    plan.summary.bars.total[key]++;
  };

  const barsById = new Map(existingBars.map((b) => [b.bars_id, b]));
  const behaviourById = new Map(existingBehaviours.map((b) => [b.bars_behaviour_id, b]));
  const fileBarsIds = new Set(parsed.map((b) => b.bars_id));
  const fileBehaviourIds = new Set(parsed.flatMap((b) => b.behaviours.map((h) => h.bars_behaviour_id)));

  for (const bars of parsed) {
    const old = barsById.get(bars.bars_id);
    if (!old) {
      plan.barsInsert.push(bars);
      count(bars.bars_type, 'new');
    } else if (old.is_deleted) {
      plan.barsUpdate.push(bars);
      count(bars.bars_type, 'new');
    } else if ((old.bars_name ?? '') !== bars.bars_name || old.need_ai !== bars.need_ai || old.sort_order !== bars.bars_no) {
      plan.barsUpdate.push(bars);
      count(bars.bars_type, 'changed');
    } else {
      count(bars.bars_type, 'unchanged');
    }

    for (const beh of bars.behaviours) {
      const item = { ...beh, bars_id: bars.bars_id, key_action_id: bars.key_action_id };
      const prev = behaviourById.get(beh.bars_behaviour_id);
      if (!prev) {
        plan.behaviourInsert.push(item);
        plan.summary.behaviours.new++;
      } else if (prev.is_deleted) {
        plan.behaviourUpdate.push(item);
        plan.summary.behaviours.new++;
      } else if ((prev.bars_behaviour ?? '') !== beh.bars_behaviour || (prev.weight ?? DEFAULT_WEIGHT) !== beh.weight /* weight NULL lama = 1 */ || prev.sort_order !== beh.behaviour_no) {
        plan.behaviourUpdate.push(item);
        plan.summary.behaviours.changed++;
      } else {
        plan.summary.behaviours.unchanged++;
      }
    }
  }

  // Data aktif simulation yang tidak ada di file -> soft delete
  for (const old of existingBars) {
    if (!old.is_deleted && !fileBarsIds.has(old.bars_id)) {
      plan.barsDelete.push(old.bars_id);
      count(old.bars_type, 'deleted');
    }
  }
  for (const old of existingBehaviours) {
    if (!old.is_deleted && !fileBehaviourIds.has(old.bars_behaviour_id)) {
      plan.behaviourDelete.push(old.bars_behaviour_id);
      plan.summary.behaviours.deleted++;
    }
  }
  return plan;
}
