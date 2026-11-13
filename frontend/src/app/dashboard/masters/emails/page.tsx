'use client';
import { useEffect, useRef, useState } from 'react';
import DocumentEditor, { DocumentEditorHandle } from '@/components/document/DocumentEditor';
import { EMPTY_HEADER_FOOTER } from '@/lib/document/headerFooter';
import { mergePages } from '@/lib/document/html';
import { Paged, api, apiErrorMessage } from '@/lib/api';

type Row = {
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
  activity?: { activity_name?: string };
  parentActivity?: { activity_name?: string };
  actorFrom?: { actor_name?: string };
  actorTo?: { actor_name?: string };
  actorCc?: { actor_name?: string };
};

const EMPTY = {
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

export default function EmailsPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterActivity, setFilterActivity] = useState('');
  const editorRef = useRef<DocumentEditorHandle>(null);
  const [emailContent, setEmailContent] = useState('');
  const [contentLoadSeq, setContentLoadSeq] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');

  async function load(p = page, s = search, act = filterActivity) {
    const res = await api.get('/emails', {
      params: { search: s, page: p, limit: 10, activity_id: act || undefined },
    });
    setRows(res.data);
  }
  async function loadOptions() {
    const [a, ac] = await Promise.all([api.get('/activities/options/all'), api.get('/actors/options/all')]);
    setActivities(a.data);
    setActors(ac.data);
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => { loadOptions(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, activity_id: filterActivity });
    setEmailContent(''); // Set empty for new email
    setContentLoadSeq((s) => s + 1);
    setError('');
    setShowForm(true);
  }
  function openEdit(r: Row) {
    setEditingId(r.email_id);
    setForm({
      email_id: r.email_id,
      email_name: r.email_name ?? '',
      activity_id: r.activity_id ?? '',
      parent_activity_id: r.parent_activity_id ?? '',
      actor_from: r.actor_from ?? '',
      actor_to: r.actor_to ?? '',
      actor_cc: r.actor_cc ?? '',
      email_type: r.email_type ?? '',
      subject: r.subject ?? '',
      content: r.content ?? '',
    });
    setEmailContent(r.content || ''); // Set initial HTML for the editor
    setContentLoadSeq((s) => s + 1);
    setError('');
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pages = editorRef.current?.getPages();
    if (!pages) {
      setError('Gagal mengambil konten email');
      return;
    }
    const contentHtml = mergePages(pages);
    const payload = { ...form, content: contentHtml };
    try {
      if (editingId) {
        const { email_id, ...rest } = payload;
        await api.patch(`/emails/${editingId}`, rest);
      } else {
        await api.post('/emails', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!confirm(`Hapus email ${id}?`)) return;
    try {
      await api.delete(`/emails/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function stripHtmlTags(html: string) {
    return html.replace(/<[^>]*>?/gm, '');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Email</h1>
        <button className="btn-dark" onClick={openAdd}>Add New Email</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / nama / subject..." />
        <label className="text-sm font-medium">Activity</label>
        <select className="input max-w-xs" value={filterActivity} onChange={(e) => { const v = e.target.value; setFilterActivity(v); setPage(1); load(1, search, v); }}>
          <option value="">-- semua --</option>
          {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
        </select>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr><th>Id</th><th>Nama email</th><th>Activity</th><th>From</th><th>To</th><th>Type</th><th>Subject</th><th>Content</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.email_id}>
                <td>{r.email_id}</td>
                <td>{r.email_name}</td>
                <td>{r.activity?.activity_name ?? r.activity_id}</td>
                <td>{r.actorFrom?.actor_name ?? r.actor_from}</td>
                <td>{r.actorTo?.actor_name ?? r.actor_to}</td>
                <td>{r.email_type}</td>
                <td className="max-w-[260px] truncate">{r.subject}</td>
                <td className="max-w-[150px] truncate">{stripHtmlTags(r.content ?? '').substring(0, 50)}{r.content && r.content.length > 50 ? '...' : ''}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-light" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.email_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr><td colSpan={8} className="text-center text-slate-500">Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 text-sm mt-3">
          <button className="btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Halaman {rows?.meta.page} / {rows?.meta.totalPages} — Total {rows?.meta.total}</span>
          <button className="btn-light" disabled={rows ? page >= rows.meta.totalPages : true} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 overflow-y-auto">
          <form onSubmit={submit} className="card w-full max-w-3xl space-y-3 my-8">
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Email</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">email_id *
                <input className="input" value={form.email_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, email_id: e.target.value })} required />
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
            <label className="text-sm block">Content
              <div className="bg-white border rounded overflow-hidden mt-1 h-[600px] flex flex-col relative">
                <DocumentEditor
                  key={contentLoadSeq}
                  ref={editorRef}
                  initialHtml={emailContent}
                  headerFooter={EMPTY_HEADER_FOOTER}
                  onChange={() => {}}
                  onSaveShortcut={() => {}}
                />
              </div>
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-light" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-dark">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
