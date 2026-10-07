'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Paged, api } from '@/lib/api';

type Detail = {
  assessment_design_detail_simulation_id: string;
  sequence: number;
  simulation?: {
    simulation_id: string; simulation_name: string; simulation_desc?: string;
    group_simulation_id?: string; duration: number; channel_name?: string; status?: number;
    level_id?: string; level?: { level_id?: string } | null;
  };
};
type Avail = {
  simulation_id: string; simulation_name: string; simulation_desc?: string;
  group_simulation_id?: string; duration: number; channel_name?: string; status?: number;
  level_id?: string; level?: { level_id?: string } | null;
};

export default function DesignSimulationPage({ params }: { params: { id: string } }) {
  const designId = decodeURIComponent(params.id);
  const [rows, setRows] = useState<(Paged<Detail> & { totalDuration?: number }) | null>(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [avail, setAvail] = useState<Paged<Avail> | null>(null);
  const [asearch, setAsearch] = useState('');
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState<any[]>([]);

  async function load(s = search) {
    const res = await api.get(`/assessment-designs/${designId}/simulations`, { params: { search: s, limit: 50 } });
    setRows(res.data);
  }
  async function loadAvail() {
    const res = await api.get(`/assessment-designs/${designId}/simulations-available`, {
      params: { search: asearch, group_simulation_id: group || undefined, limit: 50 },
    });
    setAvail(res.data);
  }
  useEffect(() => { api.get('/simulations/groups/all').then((r) => setGroups(r.data)); }, []);
  // debounce search; juga memuat data awal saat mount
  useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (showAdd) loadAvail(); }, [showAdd, group]);
  useEffect(() => { if (!showAdd) return; const t = setTimeout(loadAvail, 400); return () => clearTimeout(t); }, [asearch]);

  async function add(sid: string) {
    await api.post(`/assessment-designs/${designId}/simulations`, { simulation_id: sid });
    loadAvail(); load();
  }
  async function remove(detailId: string) {
    if (!confirm('Hapus simulation dari design ini?')) return;
    await api.delete(`/assessment-designs/${designId}/simulations/${detailId}`);
    load();
  }

  return (
    <div className="space-y-4">
      <Link href="/dashboard/masters/assessment-designs" className="text-sm underline">← Assessment Design List</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assessment Design &gt; Simulation ({designId})</h1>
        <button className="btn-dark" onClick={() => setShowAdd(true)}>Add New</button>
      </div>

      <div className="card flex gap-2 items-center">
        <label className="text-sm font-medium">Search</label>
        <input className="input max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table min-w-[800px]">
          <thead><tr><th>id</th><th>Simulation</th><th>Group Simulation</th><th>duration</th><th>level</th><th>channelName</th><th>Action</th></tr></thead>
          <tbody>
            {rows?.data.map((d) => (
              <tr key={d.assessment_design_detail_simulation_id}>
                <td>{d.simulation?.simulation_id}</td>
                <td>{d.simulation?.simulation_name}</td>
                <td>{d.simulation?.group_simulation_id}</td>
                <td>{d.simulation?.duration}</td>
                <td>{d.simulation?.level?.level_id ?? d.simulation?.level_id}</td>
                <td>{d.simulation?.channel_name}</td>
                <td className="space-x-1">
                  <button className="btn-light" onClick={() => alert(JSON.stringify(d.simulation, null, 2))}>Detail</button>
                  <button className="btn-light" onClick={() => remove(d.assessment_design_detail_simulation_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm mt-2">Total duration: <b>{rows?.totalDuration ?? 0}</b></p>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
          <div className="card w-full max-w-4xl space-y-3 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Add Simulation ke {designId}</h2>
              <button className="btn-light" onClick={() => setShowAdd(false)}>Tutup</button>
            </div>
            <div className="flex gap-2 items-center">
              <input className="input max-w-sm" placeholder="Search..." value={asearch} onChange={(e) => setAsearch(e.target.value)} />
              <label className="text-sm">group simulation</label>
              <select className="input max-w-xs" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">Dropdown list - semua</option>
                {groups.map((g: any) => <option key={g.group_simulation_id} value={g.group_simulation_id}>{g.group_simulation_id}</option>)}
              </select>
            </div>
            <table className="table">
              <thead><tr><th>No</th><th>id</th><th>Simulasi</th><th>Desc</th><th>Duration</th><th>Group</th><th>Level</th><th>Channel</th><th>Action</th></tr></thead>
              <tbody>
                {avail?.data.map((a, i) => (
                  <tr key={a.simulation_id}>
                    <td>{i + 1}</td>
                    <td>{a.simulation_id}</td>
                    <td>{a.simulation_name}</td>
                    <td>{a.simulation_desc}</td>
                    <td>{a.duration}</td>
                    <td>{a.group_simulation_id}</td>
                    <td>{a.level?.level_id ?? a.level_id}</td>
                    <td>{a.channel_name}</td>
                    <td><button className="btn-dark" onClick={() => add(a.simulation_id)}>Add</button></td>
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
