'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, apiErrorMessage } from '@/lib/api';

type BarItem = {
  bars_id: string;
  bars_name: string;
  need_ai: boolean;
  behaviours: string[];
};

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
  }, [simulationId]);

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
              onChange={(e) => setSimulationId(e.target.value)}
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
        </div>
      </div>

      {error && <div className="card text-red-600 text-sm">{error}</div>}

      <div className="card overflow-auto max-h-[75vh] p-0">
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
                        {row.competency}
                      </td>
                    )}
                    <td className="sticky left-[150px] z-10 bg-inherit px-3 py-2 border border-slate-200 align-top w-[260px] min-w-[260px] max-w-[260px]">
                      <div className="font-medium">{row.key_action_name}</div>
                      {row.key_action_desc && (
                        <div className="text-xs text-slate-500 mt-1">{row.key_action_desc}</div>
                      )}
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
                                <div className="font-medium">{bar.bars_name || '-'}</div>
                                {bar.behaviours.length > 0 && (
                                  <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-700">
                                    {bar.behaviours.map((b, i) => (
                                      <li key={i} className="whitespace-pre-line">
                                        {b}
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
