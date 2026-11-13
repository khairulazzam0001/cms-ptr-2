'use client';
import { useEffect, useState } from 'react';
import { Paged, api, apiErrorMessage } from '@/lib/api';

type Row = {
  actor_id: string;
  actor_name: string;
  actor_email?: string;
  actor_position?: string;
  actor_division?: string;
  actor_group_position?: string;
  superior?: string;
  design_id?: string;
  level_id?: string;
  persona_desc?: string;
  is_participant?: boolean;
  superiorActor?: { actor_name?: string };
  design?: { design_name?: string };
  level?: { level_name?: string };
};

const EMPTY = {
  actor_id: '',
  actor_name: '',
  actor_email: '',
  actor_position: '',
  actor_division: '',
  actor_group_position: '',
  superior: '',
  design_id: '',
  level_id: '',
  persona_desc: '',
  is_participant: false,
};

export default function ActorsPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterDesign, setFilterDesign] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [designs, setDesigns] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');

  async function load(p = page, s = search, dg = filterDesign, lv = filterLevel) {
    const res = await api.get('/actors', {
      params: {
        search: s,
        page: p,
        limit: 10,
        design_id: dg || undefined,
        level_id: lv || undefined,
      },
    });
    setRows(res.data);
  }
  async function loadOptions() {
    const [d, l, ac] = await Promise.all([
      api.get('/designs/options/all'),
      api.get('/levels/options/all'),
      api.get('/actors/options/all'),
    ]);
    setDesigns(d.data);
    setLevels(l.data);
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
    setForm({ ...EMPTY });
    setError('');
    setShowForm(true);
  }
  function openEdit(r: Row) {
    setEditingId(r.actor_id);
    setForm({
      actor_id: r.actor_id,
      actor_name: r.actor_name ?? '',
      actor_email: r.actor_email ?? '',
      actor_position: r.actor_position ?? '',
      actor_division: r.actor_division ?? '',
      actor_group_position: r.actor_group_position ?? '',
      superior: r.superior ?? '',
      design_id: r.design_id ?? '',
      level_id: r.level_id ?? '',
      persona_desc: r.persona_desc ?? '',
      is_participant: !!r.is_participant,
    });
    setError('');
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const { actor_id, ...rest } = form;
        await api.patch(`/actors/${editingId}`, rest);
      } else {
        await api.post('/actors', form);
      }
      setShowForm(false);
      load();
      loadOptions();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(id: string) {
    if (!confirm(`Hapus actor ${id}?`)) return;
    try {
      await api.delete(`/actors/${id}`);
      load();
      loadOptions();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Master Actor</h1>
        <button className="btn-dark" onClick={openAdd}>Add New Actor</button>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / nama / email / posisi..." />
        <label className="text-sm font-medium">Design</label>
        <select className="input max-w-xs" value={filterDesign} onChange={(e) => { const v = e.target.value; setFilterDesign(v); setPage(1); load(1, search, v, filterLevel); }}>
          <option value="">-- semua --</option>
          {designs.map((d: any) => <option key={d.design_id} value={d.design_id}>{d.design_id} - {d.design_name}</option>)}
        </select>
        <label className="text-sm font-medium">Level</label>
        <select className="input max-w-xs" value={filterLevel} onChange={(e) => { const v = e.target.value; setFilterLevel(v); setPage(1); load(1, search, filterDesign, v); }}>
          <option value="">-- semua --</option>
          {levels.map((l: any) => <option key={l.level_id} value={l.level_id}>{l.level_id} - {l.level_name}</option>)}
        </select>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table min-w-[1250px]">
          <thead>
            <tr><th>Id</th><th>Nama</th><th>Email</th><th>Posisi</th><th>Divisi</th><th>Group posisi</th><th>Atasan</th><th>Design</th><th>Level</th><th>Participant</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.actor_id}>
                <td>{r.actor_id}</td>
                <td>{r.actor_name}</td>
                <td>{r.actor_email}</td>
                <td>{r.actor_position}</td>
                <td>{r.actor_division}</td>
                <td>{r.actor_group_position}</td>
                <td>{r.superiorActor?.actor_name ?? r.superior}</td>
                <td>{r.design?.design_name ?? r.design_id}</td>
                <td>{r.level?.level_name ?? r.level_id}</td>
                <td>{r.is_participant ? 'Ya' : '-'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-light" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.actor_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows && rows.data.length === 0 && (
              <tr><td colSpan={11} className="text-center text-slate-500">Belum ada data.</td></tr>
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
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Actor</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">actor_id *
                <input className="input" value={form.actor_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, actor_id: e.target.value })} required />
              </label>
              <label className="text-sm">Nama *
                <input className="input" value={form.actor_name} onChange={(e) => setForm({ ...form, actor_name: e.target.value })} required />
              </label>
              <label className="text-sm">Email
                <input className="input" type="email" value={form.actor_email} onChange={(e) => setForm({ ...form, actor_email: e.target.value })} />
              </label>
              <label className="text-sm">Posisi
                <input className="input" value={form.actor_position} onChange={(e) => setForm({ ...form, actor_position: e.target.value })} />
              </label>
              <label className="text-sm">Divisi
                <input className="input" value={form.actor_division} onChange={(e) => setForm({ ...form, actor_division: e.target.value })} />
              </label>
              <label className="text-sm">Group posisi
                <input className="input" value={form.actor_group_position} onChange={(e) => setForm({ ...form, actor_group_position: e.target.value })} />
              </label>
              <label className="text-sm">Atasan (superior)
                <select className="input" value={form.superior} onChange={(e) => setForm({ ...form, superior: e.target.value })}>
                  <option value="">-- tidak ada --</option>
                  {actors.filter((a: any) => a.actor_id !== editingId).map((a: any) => (
                    <option key={a.actor_id} value={a.actor_id}>{a.actor_id} - {a.actor_name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Design
                <select className="input" value={form.design_id} onChange={(e) => setForm({ ...form, design_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {designs.map((d: any) => <option key={d.design_id} value={d.design_id}>{d.design_id} - {d.design_name}</option>)}
                </select>
              </label>
              <label className="text-sm">Level
                <select className="input" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}>
                  <option value="">-- pilih --</option>
                  {levels.map((l: any) => <option key={l.level_id} value={l.level_id}>{l.level_id} - {l.level_name}</option>)}
                </select>
              </label>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input type="checkbox" checked={form.is_participant} onChange={(e) => setForm({ ...form, is_participant: e.target.checked })} />
                Participant (is_participant)
              </label>
            </div>
            <label className="text-sm block">Persona description
              <textarea className="input min-h-[110px]" value={form.persona_desc} onChange={(e) => setForm({ ...form, persona_desc: e.target.value })} />
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
