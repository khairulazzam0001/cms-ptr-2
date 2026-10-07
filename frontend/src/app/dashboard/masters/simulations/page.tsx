'use client';
import { useEffect, useState } from 'react';
import { Paged, api } from '@/lib/api';

export default function SimulationsPage() {
  const [rows, setRows] = useState<Paged<any> | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ simulation_id: '', simulation_name: '', simulation_desc: '', duration: 30, channel_name: '', group_simulation_id: '', level_id: '3', status: 1 });
  async function load(s = search) {
    const r = await api.get('/simulations', { params: { search: s, limit: 20 } });
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/simulations', { ...form, duration: Number(form.duration), status: Number(form.status) });
    setForm({ simulation_id: '', simulation_name: '', simulation_desc: '', duration: 30, channel_name: '', group_simulation_id: '', level_id: '3', status: 1 }); load();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Master Simulation</h1>
      <div className="card"><form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="input max-w-[150px]" placeholder="simulation_id" value={form.simulation_id} onChange={(e) => setForm({ ...form, simulation_id: e.target.value })} required />
        <input className="input max-w-xs" placeholder="simulation_name" value={form.simulation_name} onChange={(e) => setForm({ ...form, simulation_name: e.target.value })} required />
        <input className="input max-w-xs" placeholder="simulation_desc" value={form.simulation_desc} onChange={(e) => setForm({ ...form, simulation_desc: e.target.value })} />
        <input className="input max-w-[110px]" type="number" placeholder="duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
        <input className="input max-w-[140px]" placeholder="channel_name" value={form.channel_name} onChange={(e) => setForm({ ...form, channel_name: e.target.value })} />
        <input className="input max-w-[150px]" placeholder="group_simulation_id" value={form.group_simulation_id} onChange={(e) => setForm({ ...form, group_simulation_id: e.target.value })} />
        <input className="input max-w-[100px]" placeholder="level_id" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} />
        <button className="btn-dark">Tambah</button>
      </form></div>
      <div className="card space-y-2 overflow-x-auto">
        <input className="input max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table min-w-[900px]"><thead><tr><th>id</th><th>name</th><th>desc</th><th>duration</th><th>channel</th><th>group_id</th><th>level</th><th>status</th><th>Aksi</th></tr></thead>
        <tbody>{rows?.data.map((r: any) => <tr key={r.simulation_id}><td>{r.simulation_id}</td><td>{r.simulation_name}</td><td>{r.simulation_desc}</td><td>{r.duration}</td><td>{r.channel_name}</td><td>{r.group_simulation_id}</td><td>{r.level?.level_id ?? r.level_id}</td><td>{r.status}</td>
        <td><button className="btn-light" onClick={async () => { if (confirm('Hapus?')) { await api.delete(`/simulations/${r.simulation_id}`); load(); } }}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
