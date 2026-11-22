'use client';
import { useEffect, useState } from 'react';
import { Paged, api, apiErrorMessage } from '@/lib/api';

type Row = {
  activity_id: string;
  activity_name: string;
  activity_desc?: string;
  level_id?: string;
  design_id?: string;
  simulation_id?: string;
  ref_activity_type_id?: string;
  state_name?: string;
  is_first?: boolean;
  level?: { level_name?: string };
  design?: { design_name?: string };
  simulation?: { simulation_name?: string };
  activityType?: { ref_activity_type_name?: string };
};

const EMPTY = {
  activity_id: '',
  activity_name: '',
  activity_desc: '',
  level_id: '',
  design_id: '',
  simulation_id: '',
  ref_activity_type_id: '',
  state_name: '',
  is_first: false,
};

export default function ActivitiesPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [levels, setLevels] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');

  async function load(p = page, s = search) {
    const res = await api.get('/activities', { params: { search: s, page: p, limit: 10 } });
    setRows(res.data);
  }
  async function loadOptions() {
    const [l, d, s, t] = await Promise.all([
      api.get('/levels/options/all'),
      api.get('/designs/options/all'),
      api.get('/simulations', { params: { limit: 100 } }),
      api.get('/activity-types/options/all'),
    ]);
    setLevels(l.data);
    setDesigns(d.data);
    setSimulations(s.data.data);
    setTypes(t.data);
  }
  useEffect(() => { load(); loadOptions(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setError('');
    setShowForm(true);
  }
  function openEdit(r: Row) {
    setEditingId(r.activity_id);
    setForm({
      activity_id: r.activity_id,
      activity_name: r.activity_name ?? '',
      activity_desc: r.activity_desc ?? '',
      level_id: r.level_id ?? '',
      design_id: r.design_id ?? '',
      simulation_id: r.simulation_id ?? '',
      ref_activity_type_id: r.ref_activity_type_id ?? '',
      state_name: r.state_name ?? '',
      is_first: !!r.is_first,
    });
    setError('');
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const { activity_id, ...rest } = form;
        await api.patch(`/activities/${editingId}`, rest);
      } else {
        await api.post('/activities', form);
      }
      setShowForm(false);
      load();
      loadOptions();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!confirm(`Hapus activity ${id}?`)) return;
    try {
      await api.delete(`/activities/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Activity</h1>
        <button className="btn-dark" onClick={openAdd}>Add New Activity</button>
      </div>

      <div className="card flex gap-2 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / name / state..." />
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr><th>Id</th><th>Name</th><th>Type</th><th>Level</th><th>Design</th><th>Simulation</th><th>State</th><th>First</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.activity_id}>
                <td>{r.activity_id}</td>
                <td>{r.activity_name}</td>
                <td>{r.activityType?.ref_activity_type_name ?? r.ref_activity_type_id}</td>
                <td>{r.level?.level_name ?? r.level_id}</td>
                <td>{r.design?.design_name ?? r.design_id}</td>
                <td>{r.simulation?.simulation_name ?? r.simulation_id}</td>
                <td>{r.state_name}</td>
                <td>{r.is_first ? 'Ya' : '-'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-light" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.activity_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-500">Belum ada data.</td></tr>
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
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Activity</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">activity_id *
                <input className="input" value={form.activity_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, activity_id: e.target.value })} required />
              </label>
              <label className="text-sm">activity_name *
                <input className="input" value={form.activity_name} onChange={(e) => setForm({ ...form, activity_name: e.target.value })} required />
              </label>
              <label className="text-sm">Level
                <select className="input" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {levels.map((x: any) => <option key={x.level_id} value={x.level_id}>{x.level_id} - {x.level_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Design
                <select className="input" value={form.design_id} onChange={(e) => setForm({ ...form, design_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {designs.map((x: any) => <option key={x.design_id} value={x.design_id}>{x.design_id} - {x.design_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Simulation
                <select className="input" value={form.simulation_id} onChange={(e) => setForm({ ...form, simulation_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {simulations.map((x: any) => <option key={x.simulation_id} value={x.simulation_id}>{x.simulation_id} - {x.simulation_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Activity type
                <select className="input" value={form.ref_activity_type_id} onChange={(e) => setForm({ ...form, ref_activity_type_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {types.map((x: any) => <option key={x.ref_activity_type_id} value={x.ref_activity_type_id}>{x.ref_activity_type_name}</option>)}
                </select>
              </label>
              <label className="text-sm">State name
                <input className="input" value={form.state_name} onChange={(e) => setForm({ ...form, state_name: e.target.value })} placeholder="mis. intro" />
              </label>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input type="checkbox" checked={form.is_first} onChange={(e) => setForm({ ...form, is_first: e.target.checked })} />
                Aktivitas pertama (is_first)
              </label>
            </div>
            <label className="text-sm block">Description
              <textarea className="input min-h-[90px]" value={form.activity_desc} onChange={(e) => setForm({ ...form, activity_desc: e.target.value })} />
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
