'use client';
import { useEffect, useState } from 'react';
import { Paged, api, apiErrorMessage } from '@/lib/api';

type Row = {
  chat_id: string;
  activity_id?: string;
  chat_name?: string;
  actor_id?: string;
  content?: string;
  activity?: { activity_name?: string };
  actor?: { actor_name?: string };
};

const EMPTY = { chat_id: '', activity_id: '', chat_name: '', actor_id: '', content: '' };

export default function ChatsPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterActivity, setFilterActivity] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');

  async function load(p = page, s = search, act = filterActivity) {
    const res = await api.get('/chats', {
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
    setError('');
    setShowForm(true);
  }
  function openEdit(r: Row) {
    setEditingId(r.chat_id);
    setForm({
      chat_id: r.chat_id,
      activity_id: r.activity_id ?? '',
      chat_name: r.chat_name ?? '',
      actor_id: r.actor_id ?? '',
      content: r.content ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const { chat_id, ...rest } = form;
        await api.patch(`/chats/${editingId}`, rest);
      } else {
        await api.post('/chats', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!confirm(`Hapus chat ${id}?`)) return;
    try {
      await api.delete(`/chats/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Chat</h1>
        <button className="btn-dark" onClick={openAdd}>Add New Chat</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / name / isi chat..." />
        <label className="text-sm font-medium">Activity</label>
        <select className="input max-w-xs" value={filterActivity} onChange={(e) => { const v = e.target.value; setFilterActivity(v); setPage(1); load(1, search, v); }}>
          <option value="">-- semua --</option>
          {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
        </select>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>Id</th><th>Activity</th><th>Chat name</th><th>Actor</th><th>Content</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.chat_id}>
                <td>{r.chat_id}</td>
                <td>{r.activity?.activity_name ?? r.activity_id}</td>
                <td>{r.chat_name}</td>
                <td>{r.actor?.actor_name ?? r.actor_id}</td>
                <td className="max-w-[380px] truncate">{r.content}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-light" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.chat_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-500">Belum ada data.</td></tr>
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
          <form onSubmit={submit} className="card w-full max-w-2xl space-y-3 my-8">
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Chat</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">chat_id *
                <input className="input" value={form.chat_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, chat_id: e.target.value })} required />
              </label>
              <label className="text-sm">Chat name
                <input className="input" value={form.chat_name} onChange={(e) => setForm({ ...form, chat_name: e.target.value })} />
              </label>
              <label className="text-sm">Activity
                <select className="input" value={form.activity_id} onChange={(e) => setForm({ ...form, activity_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Actor
                <select className="input" value={form.actor_id} onChange={(e) => setForm({ ...form, actor_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm block">Content
              <textarea className="input min-h-[140px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
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
