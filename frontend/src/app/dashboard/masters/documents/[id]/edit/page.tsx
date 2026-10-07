'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { api, apiErrorMessage } from '@/lib/api';
import { MAX_PAGES } from '@/lib/document/constants';
import { mergePages } from '@/lib/document/html';
import { DocumentDetail, DocumentHeader, SaveContentResult } from '@/lib/document/types';
import DocumentEditor, { DocumentEditorHandle } from '@/components/document/DocumentEditor';
import DocumentPreview from '@/components/document/DocumentPreview';
import HeaderFooterPanel from '@/components/document/HeaderFooterPanel';
import { EMPTY_HEADER_FOOTER, HeaderFooter, pickHeaderFooter } from '@/lib/document/headerFooter';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

// PRD Document Generator §6.6
const AUTOSAVE_MS = 10_000;
const RETRY_DELAYS_MS = [10_000, 30_000, 60_000];

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Tersimpan',
  dirty: 'Ada perubahan',
  saving: 'Menyimpan…',
  error: 'Gagal menyimpan',
  conflict: 'Konflik versi',
};

const httpStatus = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined);

export default function DocumentEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const editorRef = useRef<DocumentEditorHandle>(null);
  const [doc, setDoc] = useState<DocumentHeader | null>(null);
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [loadSeq, setLoadSeq] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveStateValue] = useState<SaveState>('saved');
  const [message, setMessage] = useState('');
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHf, setShowHf] = useState(false);
  const [headerFooter, setHeaderFooter] = useState<HeaderFooter>(EMPTY_HEADER_FOOTER);

  // State simpan dibaca di callback/timer -> simpan juga di ref
  const docRef = useRef<DocumentHeader | null>(null);
  const hfRef = useRef<HeaderFooter>(EMPTY_HEADER_FOOTER);
  const stateRef = useRef<SaveState>('saved');
  const changeSeq = useRef(0); // naik setiap edit
  const savedSeq = useRef(0); // changeSeq yang terakhir berhasil disimpan
  const inFlight = useRef<Promise<boolean> | null>(null); // maks satu request simpan
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryCount = useRef(0);

  const setSaveState = useCallback((s: SaveState) => {
    stateRef.current = s;
    setSaveStateValue(s);
  }, []);
  const updateDoc = useCallback((d: DocumentHeader) => {
    docRef.current = d;
    setDoc(d);
  }, []);
  const clearTimers = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    clearTimeout(retryTimer.current);
    setRetryIn(null);
  }, []);
  const hasUnsaved = () => changeSeq.current !== savedSeq.current || stateRef.current === 'error';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api.get<DocumentDetail>(`/documents/${encodeURIComponent(id)}`);
      const { pages, ...header } = res.data;
      clearTimers();
      changeSeq.current = 0;
      savedSeq.current = 0;
      retryCount.current = 0;
      updateDoc(header);
      hfRef.current = pickHeaderFooter(header);
      setHeaderFooter(hfRef.current);
      setName(header.document_name);
      // gabungkan halaman (tabel/list lanjutan disatukan kembali) -> satu dokumen editor
      setInitialHtml(mergePages(pages.map((p) => p.content_html)));
      setLoadSeq((n) => n + 1);
      setSaveState('saved');
      setMessage('');
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Gagal memuat dokumen'));
    }
  }, [id, clearTimers, updateDoc, setSaveState]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => clearTimers, [clearTimers]);

  const doSave = useCallback(async (): Promise<boolean> => {
    const current = docRef.current;
    if (!current) return false;
    clearTimers();
    const pages = editorRef.current?.getPages();
    if (!pages) {
      setMessage('Gagal menghitung halaman, coba lagi.');
      setSaveState('error');
      return false;
    }
    if (pages.length > MAX_PAGES) {
      setMessage(`Dokumen melebihi ${MAX_PAGES} halaman.`);
      setSaveState('error');
      return false;
    }
    const seq = changeSeq.current;
    setSaveState('saving');
    try {
      const res = await api.put<SaveContentResult>(`/documents/${encodeURIComponent(current.document_id)}/content`, {
        revision: current.revision,
        pages: pages.map((content_html, i) => ({ page: i + 1, content_html })),
        header_footer: hfRef.current,
      });
      const { pages: _saved, ...header } = res.data;
      setMessage(current.status === 'FINAL' && header.status === 'DRAFT' ? 'Dokumen kembali ke DRAFT' : '');
      updateDoc({ ...current, ...header });
      savedSeq.current = seq;
      retryCount.current = 0;
      if (changeSeq.current !== seq) {
        // ada edit selama request berjalan -> simpan lagi versi terbaru
        setSaveState('dirty');
        autosaveTimer.current = setTimeout(() => void runSaveRef.current(), AUTOSAVE_MS);
      } else {
        setSaveState('saved');
      }
      return true;
    } catch (e) {
      const status = httpStatus(e);
      if (status === 409) {
        setMessage('Dokumen telah diubah di tab/sesi lain.');
        setSaveState('conflict');
        return false;
      }
      setMessage(apiErrorMessage(e, 'Gagal menyimpan'));
      setSaveState('error');
      // retry otomatis hanya untuk network/5xx
      if ((status === undefined || status >= 500) && retryCount.current < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[retryCount.current++];
        setRetryIn(delay / 1000);
        retryTimer.current = setTimeout(() => void runSaveRef.current(), delay);
      }
      return false;
    }
  }, [clearTimers, setSaveState, updateDoc]);

  // Satu request in-flight; panggilan saat berjalan menunggu request yang sama
  const runSave = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const p: Promise<boolean> = doSave().finally(() => {
      if (inFlight.current === p) inFlight.current = null;
    });
    inFlight.current = p;
    return p;
  }, [doSave]);
  const runSaveRef = useRef(runSave);
  runSaveRef.current = runSave;

  // Simpan sekarang bila ada perubahan (sebelum preview/final/keluar). true = tidak ada yang tertunda.
  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    if (stateRef.current === 'conflict') return false;
    if (hasUnsaved()) return runSave();
    return true;
  }, [runSave]);

  const onChange = useCallback(() => {
    changeSeq.current += 1;
    if (stateRef.current === 'conflict') return; // tunggu keputusan Muat ulang / Timpa
    if (stateRef.current !== 'saving') setSaveState('dirty');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void runSaveRef.current(), AUTOSAVE_MS);
  }, [setSaveState]);

  // Peringatan browser bila ada perubahan belum tersimpan (FR-53)
  useEffect(() => {
    if (saveState === 'saved') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  const leave = useCallback(
    async (href: string) => {
      const ok = await flush();
      if (ok || confirm('Perubahan belum tersimpan. Tetap tinggalkan halaman?')) router.push(href);
    },
    [flush, router],
  );

  // Autosave saat pindah halaman lewat link internal (sidebar, dll.) (FR-50)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest('a');
      if (!a || a.target === '_blank' || !a.href) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || !hasUnsaved()) return;
      e.preventDefault();
      e.stopPropagation();
      void leave(url.pathname + url.search);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [leave]);

  // Header/footer = bagian konten: ikut autosave & revision (FINAL -> DRAFT)
  function applyHeaderFooter(hf: HeaderFooter) {
    hfRef.current = hf;
    setHeaderFooter(hf);
    setShowHf(false);
    onChange();
  }

  function retryNow() {
    retryCount.current = 0;
    void runSave();
  }

  // Konflik: timpa versi server dengan isi editor saat ini
  async function overwrite() {
    const current = docRef.current;
    if (!current) return;
    try {
      const res = await api.get<DocumentDetail>(`/documents/${encodeURIComponent(current.document_id)}`);
      updateDoc({ ...current, revision: res.data.revision, status: res.data.status });
      setSaveState('dirty');
      await runSave();
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Gagal mengambil versi server'));
    }
  }

  function reloadFromServer() {
    if (hasUnsaved() && !confirm('Perubahan di editor ini akan dibuang. Muat ulang versi server?')) return;
    load();
  }

  async function openPreview() {
    setBusy(true);
    const ok = await flush(); // preview menampilkan versi tersimpan terbaru (FR-62)
    setBusy(false);
    if (ok) setShowPreview(true);
  }

  async function finalize() {
    setBusy(true);
    try {
      if (!(await flush())) return;
      const current = docRef.current!;
      const res = await api.post<DocumentHeader>(`/documents/${encodeURIComponent(current.document_id)}/finalize`, {
        revision: current.revision,
      });
      updateDoc({ ...current, status: res.data.status, modified_date: res.data.modified_date });
      setMessage('Dokumen difinalkan');
    } catch (e) {
      if (httpStatus(e) === 409) {
        setMessage('Dokumen telah diubah di tab/sesi lain.');
        setSaveState('conflict');
      } else {
        setMessage(apiErrorMessage(e, 'Gagal memfinalkan dokumen'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const current = docRef.current;
    if (!current) return;
    const next = name.trim();
    if (!next || next === current.document_name) {
      setName(current.document_name);
      return;
    }
    try {
      const res = await api.patch<DocumentHeader>(`/documents/${encodeURIComponent(current.document_id)}`, { document_name: next });
      updateDoc({ ...docRef.current!, document_name: res.data.document_name });
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Gagal mengubah nama'));
      setName(current.document_name);
    }
  }

  if (loadError) {
    return (
      <div className="card space-y-3">
        <p className="text-red-700" role="alert">{loadError}</p>
        <div className="flex gap-2">
          <button className="btn-light" onClick={load}>Coba lagi</button>
          <button className="btn-light" onClick={() => router.push('/dashboard/masters/documents')}>Kembali</button>
        </div>
      </div>
    );
  }
  if (!doc || initialHtml === null) return <div className="card text-slate-500">Memuat dokumen…</div>;

  const stateColor =
    saveState === 'error' || saveState === 'conflict' ? 'text-red-700' : saveState === 'saved' ? 'text-emerald-700' : 'text-slate-600';
  const isInfo = message === 'Dokumen kembali ke DRAFT' || message === 'Dokumen difinalkan';

  return (
    <div className="-m-6 flex flex-col h-screen">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 bg-white border-b">
        <button className="btn-light !py-1" onClick={() => leave('/dashboard/masters/documents')}>← Kembali</button>
        <span className="font-mono text-sm text-slate-500">{doc.document_id}</span>
        <input
          className="input !w-auto min-w-[14rem] !py-1 font-semibold"
          value={name}
          maxLength={150}
          aria-label="Nama dokumen"
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${doc.status === 'FINAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {doc.status}
        </span>
        <span className={`text-sm ${stateColor}`} aria-live="polite">
          {SAVE_LABEL[saveState]}
          {saveState === 'error' && retryIn !== null && ` — coba lagi otomatis dalam ${retryIn} dtk`}
        </span>
        {saveState === 'error' && <button className="btn-light !py-1" onClick={retryNow}>Coba lagi</button>}
        {saveState === 'conflict' && (
          <>
            <button className="btn-light !py-1" onClick={reloadFromServer}>Muat ulang</button>
            <button className="btn-light !py-1" onClick={overwrite}>Timpa</button>
          </>
        )}
        {message && (
          <span className={`text-sm ${isInfo ? 'text-slate-600' : 'text-red-700'}`} role={isInfo ? 'status' : 'alert'}>{message}</span>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-light !py-1" onClick={() => setShowHf(true)}>Header &amp; Footer</button>
          <button className="btn-light !py-1" onClick={openPreview} disabled={busy}>Preview</button>
          <button className="btn-dark !py-1" onClick={finalize} disabled={busy || saveState === 'conflict'}>Simpan Final</button>
        </div>
      </div>
      <DocumentEditor key={loadSeq} ref={editorRef} initialHtml={initialHtml} headerFooter={headerFooter} onChange={onChange} onSaveShortcut={() => void flush()} />
      {showHf && <HeaderFooterPanel value={headerFooter} onApply={applyHeaderFooter} onClose={() => setShowHf(false)} />}
      {showPreview && <DocumentPreview documentId={doc.document_id} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
