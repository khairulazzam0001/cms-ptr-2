'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiErrorMessage } from '@/lib/api';
import { pickHeaderFooter } from '@/lib/document/headerFooter';
import { DocumentDetail } from '@/lib/document/types';
import PageHeaderFooter from './PageHeaderFooter';

// Preview read-only per halaman A4 dari data TERSIMPAN (PRD Document Generator §6.7).
// HTML sudah disanitasi backend saat simpan; CSS .doc-content sama dengan editor (FR-28).
export default function DocumentPreview({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<DocumentDetail>(`/documents/${encodeURIComponent(documentId)}`);
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal memuat preview'));
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = data?.pages.length ?? 0;
  const hf = data ? pickHeaderFooter(data) : null;

  function goto(i: number) {
    const target = Math.max(0, Math.min(total - 1, i));
    pageRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrent(target);
  }

  // halaman aktif = lembar terakhir yang bagian atasnya sudah lewat sepertiga layar
  function onScroll() {
    const box = scroller.current;
    if (!box) return;
    const line = box.getBoundingClientRect().top + box.clientHeight / 3;
    let idx = 0;
    pageRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) idx = i;
    });
    setCurrent(idx);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800/95" role="dialog" aria-modal="true" aria-label="Preview dokumen">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-900 text-white">
        <span className="font-semibold truncate">{data ? data.document_name : 'Preview'}</span>
        {data && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700">{data.status}</span>}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button className="btn-light !py-1 !text-slate-900" onClick={() => goto(current - 1)} disabled={current <= 0} aria-label="Halaman sebelumnya">‹</button>
          <span aria-live="polite">{total ? `Halaman ${current + 1} dari ${total}` : ''}</span>
          <button className="btn-light !py-1 !text-slate-900" onClick={() => goto(current + 1)} disabled={current >= total - 1} aria-label="Halaman berikutnya">›</button>
          <button className="btn-light !py-1 !text-slate-900" onClick={onClose} aria-label="Tutup preview (Esc)">Tutup</button>
        </div>
      </div>
      <div ref={scroller} className="flex-1 overflow-auto p-6 space-y-6" onScroll={onScroll}>
        {error && (
          <div className="card max-w-md mx-auto space-y-2">
            <p className="text-red-700" role="alert">{error}</p>
            <button className="btn-light" onClick={load}>Coba lagi</button>
          </div>
        )}
        {!data && !error && <p className="text-center text-slate-300">Memuat…</p>}
        {data && total === 0 && <p className="text-center text-slate-300">Dokumen masih kosong.</p>}
        {data?.pages.map((p, i) => (
          <div key={p.page} ref={(el) => { pageRefs.current[i] = el; }} className="space-y-1">
            <div className="doc-preview-sheet">
              <div className="doc-content" dangerouslySetInnerHTML={{ __html: p.content_html }} />
              {hf && <PageHeaderFooter hf={hf} page={i + 1} pages={total} />}
            </div>
            <p className="text-center text-xs text-slate-300">Halaman {i + 1} dari {total}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
