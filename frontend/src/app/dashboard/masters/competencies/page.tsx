'use client';
import { useEffect, useState } from 'react';
import { Paged, api } from '@/lib/api';

export default function CompetenciesPage() {
  const [rows, setRows] = useState<Paged<any> | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ competency_id: '', competency_name: '', competency_desc: '', level_id: '3' });
  async function load(s = search) {
    const r = await api.get('/competencies', { params: { search: s, limit: 20 } });
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/competencies', form);
    setForm({ competency_id: '', competency_name: '', competency_desc: '', level_id: '3' }); load();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Master Competency</h1>
      <div className="card"><form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="input max-w-[150px]" placeholder="competency_id" value={form.competency_id} onChange={(e) => setForm({ ...form, competency_id: e.target.value })} required />
        <input className="input max-w-xs" placeholder="name" value={form.competency_name} onChange={(e) => setForm({ ...form, competency_name: e.target.value })} required />
        <input className="input max-w-xs" placeholder="desc" value={form.competency_desc} onChange={(e) => setForm({ ...form, competency_desc: e.target.value })} />
        <input className="input max-w-[100px]" placeholder="level" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} />
        <button className="btn-dark">Tambah</button>
      </form></div>
      <div className="card space-y-2">
        <input className="input max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table"><thead><tr><th>id</th><th>name</th><th>desc</th><th>level</th><th>Aksi</th></tr></thead>
        <tbody>{rows?.data.map((r: any) => <tr key={r.competency_id}><td>{r.competency_id}</td><td>{r.competency_name}</td><td>{r.competency_desc}</td><td>{r.level_id}</td>
        <td><button className="btn-light" onClick={async () => { if (confirm('Hapus?')) { await api.delete(`/competencies/${r.competency_id}`); load(); } }}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
