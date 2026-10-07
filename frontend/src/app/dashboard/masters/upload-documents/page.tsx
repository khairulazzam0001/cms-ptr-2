'use client';
import { useCallback, useEffect, useState } from 'react';
import { Paged, api, apiErrorMessage } from '@/lib/api';
import { DOCUMENT_ID_PATTERN } from '@/lib/document/types';
import { UploadDocument, UploadResult, checkHtmlFile, formatBytes } from '@/lib/uploadDocument';
import HtmlPreview from '@/components/upload-document/HtmlPreview';

// Upload Document (PRD_Upload_Document.md): dokumen HTML read-only, disimpan di master_document
// (read_only = 'document') + satu baris konten page = 0.

type Modal =
  | { kind: 'upload' }
  | { kind: 'replace'; doc: UploadDocument }
  | { kind: 'edit'; doc: UploadDocument }
  | null;

const EMPTY_FORM = { document_id: '', document_name: '', document_desc: '', is_active: true };

export default function UploadDocumentListPage() {
  const [rows, setRows] = useState<Paged<UploadDocument> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; warnings: string[] } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

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
      const res = await api.get<Paged<UploadDocument>>('/upload-documents', {
        params: { search: debouncedSearch, is_active: active || undefined, page, limit: 10 },
      });
      setRows(res.data);
      setLoadError('');
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Gagal memuat dokumen'));
    }
  }, [debouncedSearch, active, page]);

  useEffect(() => {
    load();
  }, [load]);

  function open(next: Modal) {
    setModal(next);
    setFile(null);
    setFormError('');
    if (next?.kind === 'edit') {
      const d = next.doc;
      setForm({ document_id: d.document_id, document_name: d.document_name, document_desc: d.document_desc ?? '', is_active: d.is_active });
    } else {
      setForm(EMPTY_FORM);
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    setFormError(f ? checkHtmlFile(f) ?? '' : '');
    // nama dokumen dari nama file bila masih kosong (FR-UD-10)
    if (f && modal?.kind === 'upload' && !form.document_name.trim()) {
      setForm((v) => ({ ...v, document_name: f.name.replace(/\.html?$/i, '').slice(0, 150) }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    if (modal.kind !== 'edit') {
      const fileError = file ? checkHtmlFile(file) : 'File wajib diisi';
      if (fileError) return setFormError(fileError);
    }
    if (modal.kind === 'upload' && !DOCUMENT_ID_PATTERN.test(form.document_id)) {
      return setFormError('ID hanya boleh huruf, angka, "-" dan "_"');
    }
    setSubmitting(true);
    setFormError('');
    try {
      if (modal.kind === 'upload') {
        const body = new FormData();
        body.append('document_id', form.document_id);
        body.append('document_name', form.document_name);
        if (form.document_desc) body.append('document_desc', form.document_desc);
        body.append('file', file!);
        const res = await api.post<UploadResult>('/upload-documents', body);
        setNotice({ text: `Dokumen ${res.data.document_id} di-upload (${formatBytes(res.data.size_bytes)})`, warnings: res.data.warnings });
      } else if (modal.kind === 'replace') {
        const body = new FormData();
        body.append('file', file!);
        const res = await api.put<UploadResult>(`/upload-documents/${encodeURIComponent(modal.doc.document_id)}/file`, body);
        setNotice({ text: `File dokumen ${res.data.document_id} diganti (${formatBytes(res.data.size_bytes)})`, warnings: res.data.warnings });
      } else {
        await api.patch(`/upload-documents/${encodeURIComponent(modal.doc.document_id)}`, {
          document_name: form.document_name,
          document_desc: form.document_desc,
          is_active: form.is_active,
        });
        setNotice({ text: `Dokumen ${modal.doc.document_id} diperbarui`, warnings: [] });
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Gagal menyimpan'));
    } finally {
      setSubmitting(false);
    }
  }

  async function download(d: UploadDocument) {
    try {
      const res = await api.get<Blob>(`/upload-documents/${encodeURIComponent(d.document_id)}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.document_id}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ text: apiErrorMessage(err, 'Gagal mengunduh'), warnings: [] });
    }
  }

  async function remove(d: UploadDocument) {
    if (!confirm(`Hapus dokumen ${d.document_id} — ${d.document_name}?`)) return;
    try {
      await api.delete(`/upload-documents/${encodeURIComponent(d.document_id)}`);
      setNotice({ text: `Dokumen ${d.document_id} dihapus`, warnings: [] });
      if (rows && rows.data.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      setNotice({ text: apiErrorMessage(err, 'Gagal menghapus dokumen'), warnings: [] });
    }
  }

  const isFiltered = !!(debouncedSearch || active);
  const title = modal?.kind === 'upload' ? 'Upload Dokumen HTML' : modal?.kind === 'replace' ? `Ganti file ${modal.doc.document_id}` : modal ? `Edit ${modal.doc.document_id}` : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Upload Document</h1>
        <button className="btn-dark" onClick={() => open({ kind: 'upload' })}>+ Upload Dokumen</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / nama / deskripsi..." aria-label="Cari dokumen" />
        <select className="input !w-40" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Filter aktif">
          <option value="">Semua</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>

      {notice && (
        <div className="card text-sm space-y-1" role="status">
          <div className="flex items-center gap-3">
            {notice.text}
            <button className="ml-auto text-slate-500" onClick={() => setNotice(null)} aria-label="Tutup pesan">✕</button>
          </div>
          {notice.warnings.map((w) => (
            <p key={w} className="text-amber-700">⚠ {w}</p>
          ))}
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
            <tr><th>ID</th><th>Nama</th><th>Aktif</th><th>Ukuran</th><th>Terakhir diubah</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.document_id}>
                <td className="font-mono">{r.document_id}</td>
                <td>{r.document_name}</td>
                <td>{r.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td>{formatBytes(r.size_bytes)}</td>
                <td>{new Date(r.modified_date).toLocaleString('id-ID')}{r.modified_by ? ` · ${r.modified_by}` : ''}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button className="btn-light" onClick={() => setPreviewId(r.document_id)}>Preview</button>
                    <button className="btn-light" onClick={() => download(r)}>Unduh</button>
                    <button className="btn-light" onClick={() => open({ kind: 'replace', doc: r })}>Ganti file</button>
                    <button className="btn-light" onClick={() => open({ kind: 'edit', doc: r })}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-8">
                  {isFiltered ? 'Tidak ada dokumen yang cocok.' : (
                    <>Belum ada dokumen HTML. <button className="underline" onClick={() => open({ kind: 'upload' })}>Upload dokumen pertama</button></>
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

      {previewId && <HtmlPreview documentId={previewId} onClose={() => setPreviewId(null)} />}

      {modal && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <form onSubmit={submit} className="card w-full max-w-md space-y-3">
            <h2 className="font-bold">{title}</h2>
            {modal.kind === 'upload' && (
              <label className="block text-sm">ID dokumen
                <input className="input" value={form.document_id} maxLength={50} required autoFocus
                  onChange={(e) => setForm({ ...form, document_id: e.target.value.trim() })} placeholder="mis. HTML-001" />
              </label>
            )}
            {modal.kind !== 'edit' && (
              <label className="block text-sm">File HTML (.html / .htm, maks 2 MB)
                <input className="input" type="file" accept=".html,.htm,text/html" required
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
                {file && <span className="text-xs text-slate-500">{file.name} · {formatBytes(file.size)}</span>}
              </label>
            )}
            {modal.kind === 'replace' && (
              <p className="text-sm text-amber-700">Isi lama akan diganti dan tidak bisa dikembalikan.</p>
            )}
            {modal.kind !== 'replace' && (
              <>
                <label className="block text-sm">Nama
                  <input className="input" value={form.document_name} maxLength={150} required
                    onChange={(e) => setForm({ ...form, document_name: e.target.value })} />
                </label>
                <label className="block text-sm">Deskripsi (opsional)
                  <textarea className="input" rows={3} value={form.document_desc}
                    onChange={(e) => setForm({ ...form, document_desc: e.target.value })} />
                </label>
              </>
            )}
            {modal.kind === 'edit' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Aktif
              </label>
            )}
            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-light" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-dark" disabled={submitting}>
                {submitting ? 'Menyimpan…' : modal.kind === 'upload' ? 'Upload' : modal.kind === 'replace' ? 'Ganti file' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
