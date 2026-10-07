'use client';
import { useEffect, useState } from 'react';
import { Paged, api } from '@/lib/api';

export default function LevelsPage() {
  const [rows, setRows] = useState<Paged<any> | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ level_id: '', level_name: '', level_desc: '' });
  async function load(s = search) {
    const r = await api.get('/levels', { params: { search: s, limit: 20 } });
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/levels', form);
    setForm({ level_id: '', level_name: '', level_desc: '' }); load();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Master Level</h1>
      <div className="card"><form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="input max-w-[140px]" placeholder="level_id" value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} required />
        <input className="input max-w-xs" placeholder="level_name" value={form.level_name} onChange={(e) => setForm({ ...form, level_name: e.target.value })} required />
        <input className="input max-w-xs" placeholder="desc" value={form.level_desc} onChange={(e) => setForm({ ...form, level_desc: e.target.value })} />
        <button className="btn-dark">Tambah</button>
      </form></div>
      <div className="card space-y-2">
        <input className="input max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table"><thead><tr><th>level_id</th><th>name</th><th>desc</th><th>Aksi</th></tr></thead>
        <tbody>{rows?.data.map((r: any) => <tr key={r.level_id}><td>{r.level_id}</td><td>{r.level_name}</td><td>{r.level_desc}</td>
        <td><button className="btn-light" onClick={async () => { if (confirm('Hapus?')) { await api.delete(`/levels/${r.level_id}`); load(); } }}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
