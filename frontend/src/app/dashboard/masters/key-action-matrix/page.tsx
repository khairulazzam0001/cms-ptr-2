'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, apiErrorMessage } from '@/lib/api';

type BarItem = {
  bars_id: string;
  bars_name: string;
  need_ai: boolean;
  behaviours: { bars_behaviour_id: string; bars_behaviour: string }[];
};

type Tip = { text: string; x: number; y: number; below: boolean };

type MatrixRow = {
  competency_id: string;
  competency: string;
  key_action_id: string;
  key_action_name: string;
  key_action_desc: string | null;
  code: string;
  bars: { POSITIVE: BarItem[]; NETRAL: BarItem[]; NEGATIVE: BarItem[] };
};

type SimulationOption = { simulation_id: string; simulation_name?: string };

const COLUMNS = [
  { key: 'POSITIVE' as const, label: 'POSITIVE (+)', head: 'bg-emerald-700' },
  { key: 'NETRAL' as const, label: 'NETRAL (/)', head: 'bg-amber-500' },
  { key: 'NEGATIVE' as const, label: 'NEGATIVE (-)', head: 'bg-red-700' },
];

export default function KeyActionMatrixPage() {
  const [simulations, setSimulations] = useState<SimulationOption[]>([]);
  const [simulationId, setSimulationId] = useState('');
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState('');
  // Dialog hapus permanen: user wajib mengetik simulation_id
  const [purge, setPurge] = useState<{
    counts: { bars: number; behaviours: number } | null;
    confirm: string;
    busy: boolean;
    error: string;
  } | null>(null);

  function openPurge() {
    setNotice('');
    setPurge({ counts: null, confirm: '', busy: false, error: '' });
    api
      .get<{ bars_total: number; behaviours: number }>('/key-action-bars/summary', {
        params: { simulation_id: simulationId },
      })
      .then((r) =>
        setPurge((p) => p && { ...p, counts: { bars: r.data.bars_total, behaviours: r.data.behaviours } }),
      )
      .catch((e) => setPurge((p) => p && { ...p, error: apiErrorMessage(e, 'Gagal memuat jumlah data') }));
  }

  async function runPurge() {
    if (!purge) return;
    setPurge({ ...purge, busy: true, error: '' });
    try {
      const r = await api.delete<{ bars_deleted: number; behaviours_deleted: number }>('/key-action-bars', {
        params: { simulation_id: simulationId },
      });
      setPurge(null);
      setNotice(
        `${r.data.bars_deleted} BARS dan ${r.data.behaviours_deleted} behaviour simulation ${simulationId} dihapus permanen.`,
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      setPurge((p) => p && { ...p, busy: false, error: apiErrorMessage(e, 'Gagal menghapus data') });
    }
  }

  // Tooltip ID: posisi fixed agar tidak terpotong overflow tabel / kolom sticky
  const idTip = (id: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const below = r.top < 48;
      setTip({ text: id, x: r.left, y: below ? r.bottom + 6 : r.top - 6, below });
    },
    onMouseLeave: () => setTip(null),
  });
  const TIP = 'cursor-help rounded-sm hover:bg-sky-100';

  // Dropdown simulation; ?simulation_id= dari halaman Import BARS
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('simulation_id') ?? '';
    api
      .get<SimulationOption[]>('/simulations/options/all')
      .then((r) => {
        setSimulations(r.data);
        if (fromQuery && r.data.some((s) => s.simulation_id === fromQuery)) setSimulationId(fromQuery);
        else if (r.data.length && !simulationId) setSimulationId(r.data[0].simulation_id);
      })
      .catch((e) => setError(apiErrorMessage(e, 'Gagal memuat simulation')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambil matriks setiap simulation berubah
  useEffect(() => {
    if (!simulationId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get<MatrixRow[]>('/key-action-matrix', { params: { simulation_id: simulationId } })
      .then((r) => setRows(r.data))
      .catch((e) => setError(apiErrorMessage(e, 'Gagal memuat data matriks')))
      .finally(() => setLoading(false));
  }, [simulationId, reloadKey]);

  // Sembunyikan key action yang belum punya BARS untuk simulation ini
  const displayRows = useMemo(
    () =>
      showEmpty
        ? rows
        : rows.filter(
            (r) =>
              r.bars.POSITIVE.length || r.bars.NETRAL.length || r.bars.NEGATIVE.length,
          ),
    [rows, showEmpty],
  );

  // Row span per competency (baris berurutan dari backend)
  const spanMap = useMemo(() => {
    const map = new Map<string, number>();
    displayRows.forEach((r) =>
      map.set(r.competency_id, (map.get(r.competency_id) ?? 0) + 1),
    );
    return map;
  }, [displayRows]);
  const seen = new Set<string>();
  const simulation = simulations.find((s) => s.simulation_id === simulationId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Key Action Matrix</h1>
          <p className="text-sm text-slate-500">
            Gabungan Key Action, BARS, dan Behaviour per simulation (read-only).
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Simulation</label>
            <select
              className="input min-w-[280px]"
              value={simulationId}
              onChange={(e) => {
                setSimulationId(e.target.value);
                setNotice('');
              }}
            >
              <option value="">— pilih simulation —</option>
              {simulations.map((s) => (
                <option key={s.simulation_id} value={s.simulation_id}>
                  {s.simulation_name ? `${s.simulation_name} (${s.simulation_id})` : s.simulation_id}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
            />
            Tampilkan key action tanpa BARS
          </label>
          <Link
            className="btn-light mb-1"
            href={`/dashboard/masters/key-action-bars-import${simulationId ? `?simulation_id=${encodeURIComponent(simulationId)}` : ''}`}
          >
            Import / Export BARS
          </Link>
          <button
            type="button"
            className="btn mb-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            disabled={!simulationId}
            onClick={openPurge}
          >
            Hapus BARS
          </button>
        </div>
      </div>

      {error && <div className="card text-red-600 text-sm">{error}</div>}
      {notice && (
        <div className="card text-emerald-700 text-sm" role="status">
          {notice}
        </div>
      )}

      {purge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className="card w-full max-w-md space-y-3 bg-white">
            <h2 className="text-lg font-bold text-red-700">Hapus permanen BARS</h2>
            <p className="text-sm">
              Semua BARS dan behaviour simulation{' '}
              <b>{simulation?.simulation_name ?? simulationId}</b> akan <b>dihapus permanen</b> dari
              database (bukan soft delete), termasuk data yang sebelumnya sudah dihapus.{' '}
              <b>Tidak bisa dibatalkan.</b>
            </p>
            <p className="text-sm text-slate-600">
              {purge.counts
                ? `Data aktif: ${purge.counts.bars} BARS, ${purge.counts.behaviours} behaviour.`
                : 'Memuat jumlah data…'}
            </p>
            <p className="text-xs text-slate-500">
              Saran: unduh dulu lewat Import / Export BARS → Export data sebagai cadangan.
            </p>
            <label className="block text-sm">
              Ketik <code className="font-mono font-semibold">{simulationId}</code> untuk konfirmasi
              <input
                className="input mt-1 w-full font-mono"
                value={purge.confirm}
                autoFocus
                onChange={(e) => setPurge({ ...purge, confirm: e.target.value })}
              />
            </label>
            {purge.error && (
              <div className="text-sm text-red-600" role="alert">
                {purge.error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-light" disabled={purge.busy} onClick={() => setPurge(null)}>
                Batal
              </button>
              <button
                type="button"
                className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={purge.busy || purge.confirm !== simulationId}
                onClick={runPurge}
              >
                {purge.busy ? 'Menghapus…' : 'Hapus permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 rounded bg-slate-900 px-2 py-1 font-mono text-xs text-white shadow-lg"
          style={{
            left: tip.x,
            top: tip.y,
            transform: tip.below ? undefined : 'translateY(-100%)',
          }}
        >
          {tip.text}
        </div>
      )}

      <div className="card overflow-auto max-h-[75vh] p-0" onScroll={() => setTip(null)}>
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 bg-slate-800 text-white text-left px-3 py-2 border border-slate-600 w-[150px] min-w-[150px] max-w-[150px]"
              >
                KOMPETENSI
              </th>
              <th
                rowSpan={2}
                className="sticky left-[150px] z-30 bg-slate-800 text-white text-left px-3 py-2 border border-slate-600 w-[260px] min-w-[260px] max-w-[260px]"
              >
                KEY ACTION
              </th>
              <th
                rowSpan={2}
                className="bg-slate-800 text-white text-left px-3 py-2 border border-slate-600 w-16"
              >
                KODE
              </th>
              <th colSpan={3} className="bg-slate-700 text-white text-center px-3 py-2 border border-slate-600">
                BARS
              </th>
            </tr>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`${c.head} text-white text-center px-3 py-2 border border-slate-600 min-w-[300px]`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  Memuat data…
                </td>
              </tr>
            )}
            {!loading && !displayRows.length && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  {!simulationId
                    ? 'Pilih simulation dulu.'
                    : rows.length
                      ? 'Tidak ada BARS untuk simulation ini (centang “Tampilkan key action tanpa BARS”).'
                      : 'Tidak ada data untuk simulation ini.'}
                </td>
              </tr>
            )}
            {!loading &&
              displayRows.map((row) => {
                const first = !seen.has(row.competency_id);
                if (first) seen.add(row.competency_id);
                return (
                  <tr key={row.key_action_id} className="align-top odd:bg-white even:bg-slate-50">
                    {first && (
                      <td
                        rowSpan={spanMap.get(row.competency_id)}
                        className="sticky left-0 z-10 bg-inherit px-3 py-2 border border-slate-200 font-semibold align-top w-[150px] min-w-[150px] max-w-[150px]"
                      >
                        <span {...idTip(row.competency_id)} className={TIP}>
                          {row.competency}
                        </span>
                      </td>
                    )}
                    <td className="sticky left-[150px] z-10 bg-inherit px-3 py-2 border border-slate-200 align-top w-[260px] min-w-[260px] max-w-[260px]">
                      <div {...idTip(row.key_action_id)} className={TIP}>
                        <div className="font-medium">{row.key_action_name}</div>
                        {row.key_action_desc && (
                          <div className="text-xs text-slate-500 mt-1">{row.key_action_desc}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border border-slate-200 font-mono text-xs">{row.code}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-2 border border-slate-200 align-top">
                        {row.bars[c.key].length === 0 ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <ol className="list-decimal pl-4 space-y-2">
                            {row.bars[c.key].map((bar) => (
                              <li key={bar.bars_id}>
                                <div {...idTip(bar.bars_id)} className={`font-medium ${TIP}`}>
                                  {bar.bars_name || '-'}
                                </div>
                                {bar.behaviours.length > 0 && (
                                  <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-700">
                                    {bar.behaviours.map((b) => (
                                      <li
                                        key={b.bars_behaviour_id}
                                        {...idTip(b.bars_behaviour_id)}
                                        className={`whitespace-pre-line ${TIP}`}
                                      >
                                        {b.bars_behaviour}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        {simulation ? `Simulation: ${simulation.simulation_name ?? simulation.simulation_id}` : ''}
        {rows.length ? ` · ${rows.length} key action` : ''}
      </p>
    </div>
  );
}
