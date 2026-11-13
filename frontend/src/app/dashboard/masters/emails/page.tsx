'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function EmailsPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterActivity, setFilterActivity] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function load(p = page, s = search, act = filterActivity) {
    const res = await api.get('/emails', {
      params: { search: s, page: p, limit: 10, activity_id: act || undefined },
    });
    setRows(res.data);
  }
  async function loadOptions() {
    const a = await api.get('/activities/options/all');
    setActivities(a.data);
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => { loadOptions(); }, []);

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
        <Link className="btn-dark" href="/dashboard/masters/emails/new">Add New Email</Link>
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
                    <Link className="btn-light" href={`/dashboard/masters/emails/${r.email_id}`}>Edit</Link>
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
    </div>
  );
}
