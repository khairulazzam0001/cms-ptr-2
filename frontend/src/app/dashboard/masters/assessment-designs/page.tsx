'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Paged, api } from '@/lib/api';

type Row = {
  assessment_design_id: string;
  assessment_design_name: string;
  level_id?: string;
  design_id?: string;
  level?: { level_name?: string };
  design?: { design_name?: string };
  competency_count: number;
  simulation_count: number;
};

export default function AssessmentDesignListPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [levels, setLevels] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [form, setForm] = useState({ assessment_design_id: '', assessment_design_name: '', level_id: '', design_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load(p = page, s = search) {
    const res = await api.get('/assessment-designs', { params: { search: s, page: p, limit: 10 } });
    setRows(res.data);
  }
  async function loadOptions() {
    const [l, d] = await Promise.all([api.get('/levels/options/all'), api.get('/designs/options/all')]);
    setLevels(l.data); setDesigns(d.data);
  }
  useEffect(() => { load(); loadOptions(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) await api.patch(`/assessment-designs/${editingId}`, {
      assessment_design_name: form.assessment_design_name,
      level_id: form.level_id || undefined,
      design_id: form.design_id || undefined,
    });
    else await api.post('/assessment-designs', form);
    setShowForm(false); setEditingId(null);
    setForm({ assessment_design_id: '', assessment_design_name: '', level_id: '', design_id: '' });
    load();
  }

  async function remove(id: string) {
    if (!confirm(`Hapus design ${id}?`)) return;
    await api.delete(`/assessment-designs/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assessment Design List</h1>
        <button className="btn-dark" onClick={() => { setShowForm(true); setEditingId(null); setForm({ assessment_design_id: '', assessment_design_name: '', level_id: '', design_id: '' }); }}>
          Add New Assessment Design
        </button>
      </div>

      <div className="card flex gap-2 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari id / name..." />
      </div>

      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>Id</th><th>Name</th><th>Level</th><th>Design</th><th>Competency</th><th>Simulation</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.assessment_design_id}>
                <td>{r.assessment_design_id}</td>
                <td>{r.assessment_design_name}</td>
                <td>{r.level?.level_name ?? r.level_id}</td>
                <td>{r.design?.design_name ?? r.design_id}</td>
                <td>{r.competency_count}</td>
                <td>{r.simulation_count}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Link className="btn-light" href={`/dashboard/masters/assessment-designs/${r.assessment_design_id}/competencies`}>View Competency</Link>
                    <Link className="btn-light" href={`/dashboard/masters/assessment-designs/${r.assessment_design_id}/simulations`}>View Simulation</Link>
                    <button className="btn-light" onClick={() => { setEditingId(r.assessment_design_id); setForm({ assessment_design_id: r.assessment_design_id, assessment_design_name: r.assessment_design_name, level_id: r.level_id ?? '', design_id: r.design_id ?? '' }); setShowForm(true); }}>Edit</button>
                    <button className="btn-light" onClick={() => remove(r.assessment_design_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 text-sm mt-3">
          <button className="btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Halaman {rows?.meta.page} / {rows?.meta.totalPages} — Total {rows?.meta.total}</span>
          <button className="btn-light" disabled={rows ? page >= rows.meta.totalPages : true} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
          <form onSubmit={submit} className="card w-full max-w-md space-y-3">
            <h2 className="font-bold">{editingId ? 'Edit' : 'Add'} Assessment Design</h2>
            <label className="text-sm">id
              <input className="input" value={form.assessment_design_id} disabled={!!editingId} onChange={(e) => setForm({ ...form, assessment_design_id: e.target.value })} required />
            </label>
            <label className="text-sm">Name
              <input className="input" value={form.assessment_design_name} onChange={(e) => setForm({ ...form, assessment_design_name: e.target.value })} required />
            </label>
            <label className="text-sm">Level
              <select className="input" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}>
                <option value="">-- pilih --</option>
                {levels.map((l: any) => <option key={l.level_id} value={l.level_id}>{l.level_id} - {l.level_name}</option>)}
              </select>
            </label>
            <label className="text-sm">Design
              <select className="input" value={form.design_id} onChange={(e) => setForm({ ...form, design_id: e.target.value })}>
                <option value="">-- pilih --</option>
                {designs.map((d: any) => <option key={d.design_id} value={d.design_id}>{d.design_id} - {d.design_name}</option>)}
              </select>
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
