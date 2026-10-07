'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Paged, api } from '@/lib/api';

type Detail = {
  assessment_design_detail_competency_id: string;
  competency?: { competency_id: string; competency_name: string; competency_desc?: string; level_id?: string };
};
type Avail = { competency_id: string; competency_name: string; competency_desc?: string; level?: { level_id?: string } | null; level_id?: string };

export default function DesignCompetencyPage({ params }: { params: { id: string } }) {
  const designId = decodeURIComponent(params.id);
  const [rows, setRows] = useState<Paged<Detail> | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [avail, setAvail] = useState<Paged<Avail> | null>(null);
  const [asearch, setAsearch] = useState('');

  async function load(s = search) {
    const res = await api.get(`/assessment-designs/${designId}/competencies`, { params: { search: s, limit: 50 } });
    setRows(res.data);
  }
  async function loadAvail(s = asearch) {
    const res = await api.get(`/assessment-designs/${designId}/competencies-available`, { params: { search: s, limit: 50 } });
    setAvail(res.data);
  }
  // debounce search; juga memuat data awal saat mount
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (showAdd) loadAvail(); }, [showAdd]);
  useEffect(() => { if (!showAdd) return; const t = setTimeout(() => loadAvail(asearch), 400); return () => clearTimeout(t); }, [asearch]);

  async function add(cid: string) {
    await api.post(`/assessment-designs/${designId}/competencies`, { competency_id: cid });
    loadAvail(); load();
  }
  async function remove(detailId: string) {
    if (!confirm('Hapus competency dari design ini?')) return;
    await api.delete(`/assessment-designs/${designId}/competencies/${detailId}`);
    load();
  }

  return (
    <div className="space-y-4">
      <Link href="/dashboard/masters/assessment-designs" className="text-sm underline">← Assessment Design List</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assessment Design &gt; Competency ({designId})</h1>
        <button className="btn-dark" onClick={() => setShowAdd(true)}>Add Competency</button>
      </div>

      <div className="card flex gap-2 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>id</th><th>competency</th><th>description</th><th>level_id</th><th>Action</th></tr></thead>
          <tbody>
            {rows?.data.map((d) => (
              <tr key={d.assessment_design_detail_competency_id}>
                <td>{d.competency?.competency_id}</td>
                <td>{d.competency?.competency_name}</td>
                <td>{d.competency?.competency_desc}</td>
                <td>{(d.competency as any)?.level?.level_id ?? d.competency?.level_id}</td>
                <td><button className="btn-light" onClick={() => remove(d.assessment_design_detail_competency_id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
          <div className="card w-full max-w-3xl space-y-3 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Add Competency ke {designId}</h2>
              <button className="btn-light" onClick={() => setShowAdd(false)}>Tutup</button>
            </div>
            <input className="input max-w-sm" placeholder="Search..." value={asearch} onChange={(e) => setAsearch(e.target.value)} />
            <table className="table">
              <thead><tr><th>id</th><th>Competency</th><th>Description</th><th>Level ID</th><th>Action</th></tr></thead>
              <tbody>
                {avail?.data.map((a) => (
                  <tr key={a.competency_id}>
                    <td>{a.competency_id}</td>
                    <td>{a.competency_name}</td>
                    <td>{a.competency_desc}</td>
                    <td>{a.level?.level_id ?? a.level_id}</td>
                    <td><button className="btn-dark" onClick={() => add(a.competency_id)}>Add</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
