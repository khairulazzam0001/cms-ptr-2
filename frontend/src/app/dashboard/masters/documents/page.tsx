'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Paged, api, apiErrorMessage } from '@/lib/api';
import { DOCUMENT_ID_PATTERN, DocumentHeader } from '@/lib/document/types';
import DocumentPreview from '@/components/document/DocumentPreview';

const EMPTY_FORM = { document_id: '', document_name: '', document_desc: '' };

function StatusBadge({ status }: { status: DocumentHeader['status'] }) {
  const cls = status === 'FINAL' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function DocumentListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Paged<DocumentHeader> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [dupSource, setDupSource] = useState<DocumentHeader | null>(null);
  const [dupForm, setDupForm] = useState({ document_id: '', document_name: '' });
  const [dupError, setDupError] = useState('');

  // debounce 400 ms hanya untuk search; filter & paging langsung
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paged<DocumentHeader>>('/documents', {
        params: { search: debouncedSearch, status: status || undefined, is_active: active || undefined, page, limit: 10 },
      });
      setRows(res.data);
      setLoadError('');
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Gagal memuat dokumen'));
    }
  }, [debouncedSearch, status, active, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!DOCUMENT_ID_PATTERN.test(form.document_id)) {
      setFormError('ID hanya boleh huruf, angka, "-" dan "_"');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/documents', {
        document_id: form.document_id,
        document_name: form.document_name,
        document_desc: form.document_desc || undefined,
      });
      router.push(`/dashboard/masters/documents/${encodeURIComponent(form.document_id)}/edit`);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Gagal membuat dokumen'));
      setSubmitting(false);
    }
  }

  function openDuplicate(r: DocumentHeader) {
    setDupSource(r);
    setDupForm({ document_id: '', document_name: `Salinan dari ${r.document_name}`.slice(0, 150) });
    setDupError('');
  }

  async function submitDuplicate(e: React.FormEvent) {
    e.preventDefault();
    if (!dupSource) return;
    if (!DOCUMENT_ID_PATTERN.test(dupForm.document_id)) {
      setDupError('ID hanya boleh huruf, angka, "-" dan "_"');
      return;
    }
    setSubmitting(true);
    setDupError('');
    try {
      await api.post(`/documents/${encodeURIComponent(dupSource.document_id)}/duplicate`, {
        document_id: dupForm.document_id,
        document_name: dupForm.document_name.trim() || undefined,
      });
      setNotice(`Dokumen ${dupSource.document_id} diduplikat menjadi ${dupForm.document_id}`);
      setDupSource(null);
      load();
    } catch (err) {
      setDupError(apiErrorMessage(err, 'Gagal menduplikat dokumen'));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(r: DocumentHeader) {
    if (!confirm(`Hapus dokumen ${r.document_id} — ${r.document_name}?`)) return;
    try {
      await api.delete(`/documents/${encodeURIComponent(r.document_id)}`);
      setNotice(`Dokumen ${r.document_id} dihapus`);
      // halaman terakhir jadi kosong -> mundur satu halaman
      if (rows && rows.data.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Gagal menghapus dokumen'));
    }
  }

  const isFiltered =!!(debouncedSearch || status || active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Document</h1>
        <button className="btn-dark" onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowForm(true); }}>
          + Dokumen Baru
        </button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / nama / deskripsi..." aria-label="Cari dokumen" />
        <select className="input !w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter status">
          <option value="">Semua status</option>
          <option value="DRAFT">DRAFT</option>
          <option value="FINAL">FINAL</option>
        </select>
        <select className="input !w-40" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Filter aktif">
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>

      {notice && (
        <div className="card flex items-center gap-3 text-sm" role="status">
          {notice}
          <button className="ml-auto text-slate-500" onClick={() => setNotice('')} aria-label="Tutup pesan">✕</button>
        </div>
      )}

      {loadError && (
        <div className="card text-red-700 flex items-center gap-3" role="alert">
          {loadError}
          <button className="btn-light" onClick={load}>Coba lagi</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[800px]">
          <thead>
            <tr><th>ID</th><th>Nama</th><th>Status</th><th>Aktif</th><th>Halaman</th><th>Terakhir diubah</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.document_id}>
                <td className="font-mono">{r.document_id}</td>
                <td>{r.document_name}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td>{r.page_count}</td>
                <td>{new Date(r.modified_date).toLocaleString('id-ID')}{r.modified_by ? ` · ${r.modified_by}` : ''}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Link className="btn-light" href={`/dashboard/masters/documents/${encodeURIComponent(r.document_id)}/edit`}>Edit</Link>
                    <button className="btn-light" onClick={() => setPreviewId(r.document_id)}>Preview</button>
                    <button className="btn-light" onClick={() => openDuplicate(r)}>Duplikat</button>
                    <button className="btn-light" onClick={() => remove(r)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-8">
                  {isFiltered ? 'Tidak ada dokumen yang cocok.' : (
                    <>Belum ada dokumen. <button className="underline" onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}>Buat dokumen pertama</button></>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 text-sm mt-3">
          <button className="btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Halaman {rows?.meta.page ?? '-'} / {rows ? Math.max(1, rows.meta.totalPages) : '-'} — Total {rows?.meta.total ?? 0}</span>
          <button className="btn-light" disabled={!rows || page >= rows.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {previewId && <DocumentPreview documentId={previewId} onClose={() => setPreviewId(null)} />}

      {dupSource && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <form onSubmit={submitDuplicate} className="card w-full max-w-md space-y-3">
            <h2 className="font-bold">Duplikat {dupSource.document_id}</h2>
            <label className="block text-sm">ID dokumen baru
              <input className="input" value={dupForm.document_id} maxLength={50} required autoFocus
                onChange={(e) => setDupForm({ ...dupForm, document_id: e.target.value.trim() })} />
            </label>
            <label className="block text-sm">Nama
              <input className="input" value={dupForm.document_name} maxLength={150}
                onChange={(e) => setDupForm({ ...dupForm, document_name: e.target.value })} />
            </label>
            <p className="text-xs text-slate-500">Semua halaman ikut disalin. Status hasil duplikat: DRAFT.</p>
            {dupError && <p className="text-sm text-red-700" role="alert">{dupError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-light" onClick={() => setDupSource(null)}>Batal</button>
              <button className="btn-dark" disabled={submitting}>{submitting ? 'Menyalin…' : 'Duplikat'}</button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <form onSubmit={submit} className="card w-full max-w-md space-y-3">
            <h2 className="font-bold">Dokumen Baru</h2>
            <label className="block text-sm">ID dokumen
              <input className="input" value={form.document_id} maxLength={50} required autoFocus
                onChange={(e) => setForm({ ...form, document_id: e.target.value.trim() })} placeholder="mis. DOC-001" />
            </label>
            <label className="block text-sm">Nama
              <input className="input" value={form.document_name} maxLength={150} required
                onChange={(e) => setForm({ ...form, document_name: e.target.value })} />
            </label>
            <label className="block text-sm">Deskripsi (opsional)
              <textarea className="input" rows={3} value={form.document_desc}
                onChange={(e) => setForm({ ...form, document_desc: e.target.value })} />
            </label>
            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-light" onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn-dark" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan & buka editor'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
