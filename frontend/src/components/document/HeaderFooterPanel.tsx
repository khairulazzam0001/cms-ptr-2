'use client';
import { useEffect, useState } from 'react';
import { HF_MAX_LENGTH, HF_SLOTS, HeaderFooter } from '@/lib/document/headerFooter';

const SLOT_LABEL = { left: 'Kiri', center: 'Tengah', right: 'Kanan' } as const;

// Pengaturan header/footer dokumen. Perubahan diterapkan saat "Terapkan" (ikut autosave konten).
export default function HeaderFooterPanel({
  value,
  onApply,
  onClose,
}: {
  value: HeaderFooter;
  onApply: (hf: HeaderFooter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const section = (kind: 'header' | 'footer', title: string) => (
    <fieldset className="space-y-2">
      <legend className="font-semibold text-sm">{title}</legend>
      <div className="grid grid-cols-3 gap-2">
        {HF_SLOTS.map((slot) => {
          const key = `${kind}_${slot}` as const;
          return (
            <label key={slot} className="text-xs text-slate-600">
              {SLOT_LABEL[slot]}
              <input
                className="input !py-1 text-sm"
                value={draft[key]}
                maxLength={HF_MAX_LENGTH}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" role="dialog" aria-modal="true" aria-label="Header & footer">
      <form
        className="card w-full max-w-2xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
      >
        <h2 className="font-bold">Header &amp; Footer</h2>
        {section('header', 'Header (margin atas)')}
        {section('footer', 'Footer (margin bawah)')}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.hide_header_footer_first_page}
            onChange={(e) => setDraft({ ...draft, hide_header_footer_first_page: e.target.checked })}
          />
          Sembunyikan header/footer di halaman pertama
        </label>
        <p className="text-xs text-slate-500">
          Teks polos. Token: <code>{'{page}'}</code> = nomor halaman, <code>{'{pages}'}</code> = jumlah halaman.
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-light" onClick={onClose}>Batal</button>
          <button className="btn-dark">Terapkan</button>
        </div>
      </form>
    </div>
  );
}
