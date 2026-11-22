'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Paged, api, apiErrorMessage } from '@/lib/api';
import { useLanguages } from '@/lib/useLanguages';
import DocumentEditor, { DocumentEditorHandle } from '@/components/document/DocumentEditor';
import { EMPTY_HEADER_FOOTER } from '@/lib/document/headerFooter';
import { mergePages } from '@/lib/document/html';

type EmailRow = {
  email_id: string;
  email_name?: string;
  activity_id?: string;
  parent_activity_id?: string;
  actor_from?: string;
  actor_to?: string;
  actor_cc?: string;
  email_type?: string;
  subject?: string;
  content?: string;
};

type AttachmentRow = {
  attachment_id: string;
  email_id: string;
  doc_content_id?: string | null;
  document_id?: string | null;
  document_name?: string | null;
  document_status?: string | null;
  document_read_only?: string | null;
  page?: number | null;
  created_date?: string;
};

type DocumentRow = {
  document_id: string;
  document_name: string;
  status?: string;
};

const EMPTY_FORM = {
  email_id: '',
  email_name: '',
  activity_id: '',
  parent_activity_id: '',
  actor_from: '',
  actor_to: '',
  actor_cc: '',
  email_type: '',
  subject: '',
  content: '',
};

export default function EmailEditorForm({ emailId }: { emailId?: string }) {
  const router = useRouter();
  const isNew = !emailId;
  const editorRef = useRef<DocumentEditorHandle>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [emailContent, setEmailContent] = useState('');
  const [loadSeq, setLoadSeq] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [pickedDoc, setPickedDoc] = useState('');
  const [attachError, setAttachError] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);

  const { languages } = useLanguages();
  const [targetLang, setTargetLang] = useState('');
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, ac] = await Promise.all([
          api.get('/activities/options/all'),
          api.get('/actors/options/all'),
        ]);
        setActivities(a.data);
        setActors(ac.data);
      } catch (err) {
        setError(apiErrorMessage(err, 'Gagal memuat dropdown'));
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get<Paged<DocumentRow>>('/documents', { params: { search: docSearch || undefined, page: 1, limit: 50 } })
        .then((res) => setDocs(res.data.data))
        .catch(() => setDocs([]));
    }, 400);
    return () => clearTimeout(t);
  }, [docSearch]);

  async function loadAttachments(id: string) {
    try {
      const res = await api.get<AttachmentRow[]>(`/emails/${encodeURIComponent(id)}/attachments`);
      setAttachments(res.data);
    } catch (err) {
      setAttachError(apiErrorMessage(err, 'Gagal memuat lampiran'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!emailId) {
        setForm({ ...EMPTY_FORM });
        setEmailContent('');
        setLoadSeq((n) => n + 1);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await api.get<EmailRow>(`/emails/${encodeURIComponent(emailId)}`);
        if (cancelled) return;
        const e = res.data;
        setForm({
          email_id: e.email_id,
          email_name: e.email_name ?? '',
          activity_id: e.activity_id ?? '',
          parent_activity_id: e.parent_activity_id ?? '',
          actor_from: e.actor_from ?? '',
          actor_to: e.actor_to ?? '',
          actor_cc: e.actor_cc ?? '',
          email_type: e.email_type ?? '',
          subject: e.subject ?? '',
          content: e.content ?? '',
        });
        setEmailContent(e.content ?? '');
        setLoadSeq((n) => n + 1);
        await loadAttachments(e.email_id);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Gagal memuat email'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    const pages = editorRef.current?.getPages();
    if (!pages) {
      setError('Gagal mengambil konten email, coba lagi.');
      return;
    }
    const payload = { ...form, content: mergePages(pages) };
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/emails', payload);
        router.push(`/dashboard/masters/emails/${encodeURIComponent(payload.email_id)}`);
      } else {
        const { email_id, ...rest } = payload;
        await api.patch(`/emails/${encodeURIComponent(emailId!)}`, rest);
        setMessage('Email tersimpan');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menyimpan email'));
    } finally {
      setSaving(false);
    }
  }

  async function translateEmail() {
    const lang = languages.find((l) => l.language_id === targetLang);
    if (!lang) {
      setError('Pilih bahasa target terlebih dahulu');
      return;
    }
    const pages = editorRef.current?.getPages();
    if (!pages) {
      setError('Gagal mengambil konten email, coba lagi.');
      return;
    }
    setTranslating(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post<{ subject?: string; html?: string }>('/translate', {
        subject: form.subject ?? '',
        html: mergePages(pages),
        target_language: lang.language_name,
      });
      if (res.data.subject !== undefined) {
        setForm((f) => ({ ...f, subject: res.data.subject ?? '' }));
      }
      if (res.data.html !== undefined) {
        setEmailContent(res.data.html);
        setLoadSeq((n) => n + 1);
      }
      setMessage(`Diterjemahkan ke ${lang.language_name}. Klik Save untuk menyimpan.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menerjemahkan email'));
    } finally {
      setTranslating(false);
    }
  }

  async function addAttachment() {
    if (!emailId) return;
    if (!pickedDoc) {
      setAttachError('Pilih dokumen yang akan dilampirkan');
      return;
    }
    setAttachBusy(true);
    setAttachError('');
    try {
      await api.post(`/emails/${encodeURIComponent(emailId)}/attachments`, { document_id: pickedDoc });
      setPickedDoc('');
      await loadAttachments(emailId);
    } catch (err) {
      setAttachError(apiErrorMessage(err, 'Gagal menambah lampiran'));
    } finally {
      setAttachBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!emailId) return;
    if (!confirm(`Hapus lampiran ${attachmentId}?`)) return;
    setAttachError('');
    try {
      await api.delete(`/emails/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`);
      await loadAttachments(emailId);
    } catch (err) {
      setAttachError(apiErrorMessage(err, 'Gagal menghapus lampiran'));
    }
  }

  const attachedDocIds = new Set(attachments.map((a) => a.document_id).filter(Boolean) as string[]);
  const docChoices = docs.filter((d) => !attachedDocIds.has(d.document_id));

  if (loading) return <div className="card text-slate-500">Memuat email…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link className="btn-light" href="/dashboard/masters/emails">← Kembali</Link>
          <h1 className="text-2xl font-bold">{isNew ? 'Add Email' : `Edit Email: ${form.email_id}`}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input !w-auto !py-2"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            aria-label="Bahasa target terjemahan"
          >
            <option value="">Bahasa target…</option>
            {languages.map((l) => (
              <option key={l.language_id} value={l.language_id}>
                {l.language_name}{l.native_name ? ` (${l.native_name})` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="btn-light" onClick={translateEmail} disabled={translating || !targetLang}>
            {translating ? 'Menerjemahkan…' : 'Translate'}
          </button>
          <button className="btn-dark" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="card text-sm text-red-600" role="alert">{error}</div>}
      {message && <div className="card text-sm text-emerald-700" role="status">{message}</div>}

      <form onSubmit={save} className="card space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">email_id *
            <input
              className="input"
              value={form.email_id}
              disabled={!isNew}
              onChange={(e) => setForm({ ...form, email_id: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">Nama email
            <input className="input" value={form.email_name} onChange={(e) => setForm({ ...form, email_name: e.target.value })} />
          </label>
          <label className="text-sm">Activity
            <select className="input" value={form.activity_id} onChange={(e) => setForm({ ...form, activity_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Parent activity
            <select className="input" value={form.parent_activity_id} onChange={(e) => setForm({ ...form, parent_activity_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Dari (actor)
            <select className="input" value={form.actor_from} onChange={(e) => setForm({ ...form, actor_from: e.target.value })}>
              <option value="">-- pilih --</option>
              {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Kepada (actor)
            <select className="input" value={form.actor_to} onChange={(e) => setForm({ ...form, actor_to: e.target.value })}>
              <option value="">-- pilih --</option>
              {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
            </select>
          </label>
          <label className="text-sm">CC (actor)
            <select className="input" value={form.actor_cc} onChange={(e) => setForm({ ...form, actor_cc: e.target.value })}>
              <option value="">-- pilih --</option>
              {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Email type
            <input className="input" value={form.email_type} onChange={(e) => setForm({ ...form, email_type: e.target.value })} placeholder="mis. INTERNAL" />
          </label>
          <label className="text-sm md:col-span-2">Subject
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </label>
        </div>
      </form>

      <div className="card space-y-2">
        <h2 className="font-semibold">Content</h2>
        <div className="bg-white border rounded overflow-hidden h-[70vh] min-h-[420px] flex flex-col">
          <DocumentEditor
            key={loadSeq}
            ref={editorRef}
            initialHtml={emailContent}
            headerFooter={EMPTY_HEADER_FOOTER}
            onChange={() => {}}
            onSaveShortcut={() => {}}
          />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Email Attachment</h2>
          <span className="text-sm text-slate-500">{attachments.length} lampiran</span>
        </div>

        {isNew ? (
          <p className="text-sm text-slate-500">Simpan email terlebih dahulu untuk menambah lampiran.</p>
        ) : (
          <>
            {attachError && <p className="text-sm text-red-600" role="alert">{attachError}</p>}

            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-sm">Cari dokumen
                <input className="input max-w-xs" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="nama / id dokumen" />
              </label>
              <label className="text-sm">Dokumen
                <select className="input max-w-md" value={pickedDoc} onChange={(e) => setPickedDoc(e.target.value)}>
                  <option value="">-- pilih dokumen --</option>
                  {docChoices.map((d) => (
                    <option key={d.document_id} value={d.document_id}>
                      {d.document_id} - {d.document_name}{d.status ? ` (${d.status})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn-dark" onClick={addAttachment} disabled={attachBusy || !pickedDoc}>
                {attachBusy ? 'Menambah…' : 'Tambah Lampiran'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table min-w-[700px]">
                <thead>
                  <tr><th>Attachment ID</th><th>Dokumen</th><th>Halaman</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {attachments.map((a) => (
                    <tr key={a.attachment_id}>
                      <td className="font-mono text-xs">{a.attachment_id}</td>
                      <td>
                        {a.document_name ?? <span className="text-slate-500">Dokumen tidak ditemukan</span>}
                        {a.document_read_only === 'document' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-xs font-semibold">READ-ONLY</span>
                        )}
                        {a.document_id && <div className="text-xs text-slate-500 font-mono">{a.document_id}</div>}
                      </td>
                      <td>{a.page ?? '-'}</td>
                      <td>{a.document_status ?? '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          {a.document_id ? (
                            <Link
                              className="btn-light"
                              href={
                                a.document_read_only === 'document'
                                  ? {
                                      pathname: '/dashboard/masters/upload-documents',
                                      query: { preview: a.document_id },
                                    }
                                  : {
                                      pathname: `/dashboard/masters/documents/${a.document_id}/edit`,
                                      query: { from: `/dashboard/masters/emails/${emailId}` },
                                    }
                              }
                            >
                              Buka
                            </Link>
                          ) : (
                            <button className="btn-light" disabled>Buka</button>
                          )}
                          <button type="button" className="btn-light" onClick={() => removeAttachment(a.attachment_id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {attachments.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-slate-500">Belum ada lampiran.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
