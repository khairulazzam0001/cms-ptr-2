'use client';
import { useEffect, useState } from 'react';
import { Paged, api, apiErrorMessage } from '@/lib/api';

type Row = {
  scenario_activity_id: string;
  activity_id: string;
  triggered_activity_id?: string;
  timer?: number;
  trigger_timer?: number;
  status?: string;
  actor_id?: string;
  prompt_id?: string;
  target_actor_id?: string;
  need_reply?: string;
  document_id?: string;
  target_activity_type?: string;
  activity?: { activity_name?: string };
  triggeredActivity?: { activity_name?: string };
  actor?: { actor_name?: string };
  targetActor?: { actor_name?: string };
  prompt?: { content?: string };
  targetActivityType?: { ref_activity_type_name?: string };
};

const EMPTY = {
  scenario_activity_id: '',
  activity_id: '',
  triggered_activity_id: '',
  timer: '',
  trigger_timer: '',
  status: '',
  actor_id: '',
  prompt_id: '',
  target_actor_id: '',
  need_reply: '',
  document_id: '',
  target_activity_type: '',
};

export default function ScenarioActivitiesPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterActivity, setFilterActivity] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');

  async function load(p = page, s = search, act = filterActivity) {
    const res = await api.get('/scenario-activities', {
      params: { search: s, page: p, limit: 10, activity_id: act || undefined },
    });
    setRows(res.data);
  }
  async function loadOptions() {
    const [a, ac, pr, ty, docs] = await Promise.all([
      api.get('/activities/options/all'),
      api.get('/actors/options/all'),
      api.get('/prompts/options/all'),
      api.get('/activity-types/options/all'),
      api.get('/documents', { params: { limit: 100 } }),
    ]);
    setActivities(a.data);
    setActors(ac.data);
    setPrompts(pr.data);
    setTypes(ty.data);
    setDocuments(docs.data.data);
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
    setEditingId(r.scenario_activity_id);
    setForm({
      scenario_activity_id: r.scenario_activity_id,
      activity_id: r.activity_id ?? '',
      triggered_activity_id: r.triggered_activity_id ?? '',
      timer: r.timer === null || r.timer === undefined ? '' : String(r.timer),
      trigger_timer:
        r.trigger_timer === null || r.trigger_timer === undefined ? '' : String(r.trigger_timer),
      status: r.status ?? '',
      actor_id: r.actor_id ?? '',
      prompt_id: r.prompt_id ?? '',
      target_actor_id: r.target_actor_id ?? '',
      need_reply: r.need_reply ?? '',
      document_id: r.document_id ?? '',
      target_activity_type: r.target_activity_type ?? '',
    });
    setError('');
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload: any = { ...form };
    payload.timer = form.timer === '' ? undefined : Number(form.timer);
    payload.trigger_timer = form.trigger_timer === '' ? undefined : Number(form.trigger_timer);
    try {
      if (editingId) {
        const { scenario_activity_id, ...rest } = payload;
        await api.patch(`/scenario-activities/${editingId}`, rest);
      } else {
        await api.post('/scenario-activities', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!confirm(`Hapus scenario ${id}?`)) return;
    try {
      await api.delete(`/scenario-activities/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const actName = (id?: string) => activities.find((a: any) => a.activity_id === id)?.activity_name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Scenario Activity</h1>
        <button className="btn-dark" onClick={openAdd}>Add New Scenario</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / status / activity..." />
        <label className="text-sm font-medium">Activity</label>
        <select className="input max-w-xs" value={filterActivity} onChange={(e) => { const v = e.target.value; setFilterActivity(v); setPage(1); load(1, search, v); }}>
          <option value="">-- semua --</option>
          {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
        </select>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr><th>Id</th><th>Activity</th><th>Triggered</th><th>Status</th><th>Timer</th><th>Trigger timer</th><th>Actor</th><th>Target actor</th><th>Prompt</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.scenario_activity_id}>
                <td>{r.scenario_activity_id}</td>
                <td>{r.activity?.activity_name ?? actName(r.activity_id)}</td>
                <td>{r.triggeredActivity?.activity_name ?? r.triggered_activity_id}</td>
                <td>{r.status}</td>
                <td>{r.timer}</td>
                <td>{r.trigger_timer}</td>
                <td>{r.actor?.actor_name ?? r.actor_id}</td>
                <td>{r.targetActor?.actor_name ?? r.target_actor_id}</td>
                <td className="max-w-[220px] truncate">{r.prompt?.content ?? r.prompt_id}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-light" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.scenario_activity_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr><td colSpan={10} className="text-center text-slate-500">Belum ada data.</td></tr>
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
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Scenario Activity</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">scenario_activity_id *
                <input className="input" value={form.scenario_activity_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, scenario_activity_id: e.target.value })} required />
              </label>
              <label className="text-sm">Activity *
                <select className="input" value={form.activity_id} onChange={(e) => setForm({ ...form, activity_id: e.target.value })} required>
                  <option value="">-- pilih --</option>
                  {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Triggered activity
                <select className="input" value={form.triggered_activity_id} onChange={(e) => setForm({ ...form, triggered_activity_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {activities.map((a: any) => <option key={a.activity_id} value={a.activity_id}>{a.activity_id} - {a.activity_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Status
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="">-- pilih --</option>
                  <option value="UNEXPECTED">UNEXPECTED</option>
                  <option value="SOLUTION">SOLUTION</option>
                </select>
              </label>
              <label className="text-sm">Timer (menit)
                <input className="input" type="number" min={0} value={form.timer} onChange={(e) => setForm({ ...form, timer: e.target.value })} />
              </label>
              <label className="text-sm">Trigger timer
                <input className="input" type="number" min={0} value={form.trigger_timer} onChange={(e) => setForm({ ...form, trigger_timer: e.target.value })} />
              </label>
              <label className="text-sm">Need reply
                <input className="input" value={form.need_reply} onChange={(e) => setForm({ ...form, need_reply: e.target.value })} />
              </label>
              <label className="text-sm">Actor
                <select className="input" value={form.actor_id} onChange={(e) => setForm({ ...form, actor_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Target actor
                <select className="input" value={form.target_actor_id} onChange={(e) => setForm({ ...form, target_actor_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {actors.map((a: any) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Prompt
                <select className="input" value={form.prompt_id} onChange={(e) => setForm({ ...form, prompt_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {prompts.map((p: any) => <option key={p.prompt_id} value={p.prompt_id}>{p.prompt_id} - {(p.content ?? '').slice(0, 40)}</option>)}
                </select>
              </label>
              <label className="text-sm">Target activity type
                <select className="input" value={form.target_activity_type} onChange={(e) => setForm({ ...form, target_activity_type: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {types.map((t: any) => <option key={t.ref_activity_type_id} value={t.ref_activity_type_id}>{t.ref_activity_type_name}</option>)}
                </select>
              </label>
              <label className="text-sm md:col-span-2">Dokumen (opsional)
                <select className="input" value={form.document_id} onChange={(e) => setForm({ ...form, document_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {documents.map((d: any) => <option key={d.document_id} value={d.document_id}>{d.document_id} - {d.document_name}</option>)}
                </select>
              </label>
            </div>
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
