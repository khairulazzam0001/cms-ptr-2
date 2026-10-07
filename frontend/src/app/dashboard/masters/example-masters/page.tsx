'use client';
import { useEffect, useState } from 'react';
import { Paged, api, uploadFile } from '@/lib/api';

type Row = { id: number; nama: string; kode?: string; dokumenUrl?: string; keterangan?: string; isActive: boolean };

export default function ExampleMasterPage() {
  const [rows, setRows] = useState<Paged<Row> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ nama: '', kode: '', keterangan: '', dokumenUrl: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load() {
    const res = await api.get('/example-masters', { params: { search, page, limit: 10 } });
    setRows(res.data);
  }
  useEffect(() => { load(); }, [page]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 400); return () => clearTimeout(t); }, [search]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const up = await uploadFile(f, 'dokumen');
    setForm((s) => ({ ...s, dokumenUrl: up.url }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) await api.patch(`/example-masters/${editingId}`, form);
    else await api.post('/example-masters', form);
    setForm({ nama: '', kode: '', keterangan: '', dokumenUrl: '' });
    setEditingId(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Hapus data ini?')) return;
    await api.delete(`/example-masters/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Contoh Master (Template)</h1>

      <div className="card">
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          <input className="input" placeholder="Nama *" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
          <input className="input" placeholder="Kode" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
          <input className="input" placeholder="Keterangan" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
          <div>
            <input type="file" onChange={onFile} className="text-sm" />
            {form.dokumenUrl && <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${form.dokumenUrl}`} target="_blank" className="text-blue-600 text-sm underline">Lihat dokumen</a>}
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button className="btn-dark">{editingId ? 'Update' : 'Tambah'}</button>
            {editingId && <button type="button" className="btn-light" onClick={() => { setEditingId(null); setForm({ nama: '', kode: '', keterangan: '', dokumenUrl: '' }); }}>Batal</button>}
          </div>
        </form>
      </div>

      <div className="card space-y-3">
        <input className="input max-w-sm" placeholder="Cari nama / kode..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table">
          <thead><tr><th>Nama</th><th>Kode</th><th>Dokumen</th><th>Aksi</th></tr></thead>
          <tbody>
            {rows?.data.map((r) => (
              <tr key={r.id}>
                <td>{r.nama}</td>
                <td>{r.kode}</td>
                <td>{r.dokumenUrl ? <a className="underline text-blue-600" target="_blank" href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${r.dokumenUrl}`}>file</a> : '-'}</td>
                <td className="space-x-2">
                  <button className="btn-light" onClick={() => { setEditingId(r.id); setForm({ nama: r.nama, kode: r.kode ?? '', keterangan: r.keterangan ?? '', dokumenUrl: r.dokumenUrl ?? '' }); }}>Edit</button>
                  <button className="btn-light" onClick={() => remove(r.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 text-sm">
          <button className="btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Halaman {rows?.meta.page} / {rows?.meta.totalPages} — Total {rows?.meta.total}</span>
          <button className="btn-light" disabled={rows && page >= rows.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
