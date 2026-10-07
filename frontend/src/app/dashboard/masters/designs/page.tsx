'use client';
import { useEffect, useState } from 'react';
import { Paged, api } from '@/lib/api';

export default function DesignsPage() {
  const [rows, setRows] = useState<Paged<any> | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ design_id: '', design_name: '' });
  async function load(s = search) {
    const r = await api.get('/designs', { params: { search: s, limit: 20 } });
    setRows(r.data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/designs', form);
    setForm({ design_id: '', design_name: '' }); load();
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Master Design</h1>
      <div className="card"><form onSubmit={submit} className="flex flex-wrap gap-2">
        <input className="input max-w-[140px]" placeholder="design_id" value={form.design_id} onChange={(e) => setForm({ ...form, design_id: e.target.value })} required />
        <input className="input max-w-xs" placeholder="design_name" value={form.design_name} onChange={(e) => setForm({ ...form, design_name: e.target.value })} required />
        <button className="btn-dark">Tambah</button>
      </form></div>
      <div className="card space-y-2">
        <input className="input max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table"><thead><tr><th>design_id</th><th>name</th><th>Aksi</th></tr></thead>
        <tbody>{rows?.data.map((r: any) => <tr key={r.design_id}><td>{r.design_id}</td><td>{r.design_name}</td>
        <td><button className="btn-light" onClick={async () => { if (confirm('Hapus?')) { await api.delete(`/designs/${r.design_id}`); load(); } }}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
