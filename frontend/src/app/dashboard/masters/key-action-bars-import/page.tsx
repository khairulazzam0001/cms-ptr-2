'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { api, apiErrorMessage } from '@/lib/api';
import {
  BARS_TYPES,
  CurrentSummary,
  ImportResult,
  FILE_FORMATS,
  FORMAT_LABEL,
  FileFormat,
  RowError,
  checkXlsxFile,
  exportFileName,
  templateFileName,
  hasChanges,
  importErrorsFrom,
} from '@/lib/keyActionBars';

// Import / export BARS & behaviour per simulation via Excel (PRD_Import_BARS.md).
type SimulationOption = { simulation_id: string; simulation_name?: string };

const COUNT_COLS = [
  { key: 'new' as const, label: 'Baru', cls: 'text-emerald-700' },
  { key: 'changed' as const, label: 'Diubah', cls: 'text-amber-700' },
  { key: 'unchanged' as const, label: 'Tidak berubah', cls: 'text-slate-500' },
  { key: 'deleted' as const, label: 'Akan dihapus', cls: 'text-red-700 font-semibold' },
];

async function downloadXlsx(url: string, params: Record<string, string>, filename: string) {
  const res = await api.get<Blob>(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // dilepas sesaat setelah klik; revoke seketika bisa membatalkan unduhan di sebagian browser
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// Pesan error dari respons blob (mis. 404 saat unduh)
async function blobErrorMessage(e: unknown, fallback: string) {
  if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
    try {
      const msg = JSON.parse(await e.response.data.text())?.message;
      if (typeof msg === 'string') return msg;
    } catch { /* bukan JSON */ }
  }
  return apiErrorMessage(e, fallback);
}

export default function ImportBarsPage() {
  const [simulations, setSimulations] = useState<SimulationOption[]>([]);
  const [simulationId, setSimulationId] = useState('');
  const [current, setCurrent] = useState<CurrentSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<{ errors: RowError[]; error_total: number } | null>(null);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState<'' | 'template' | 'export'>('');
  const [downloadError, setDownloadError] = useState('');
  const [format, setFormat] = useState<FileFormat>('matrix');
  const [busy, setBusy] = useState<'' | 'preview' | 'save' | 'download'>('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Dropdown simulation; ?simulation_id= dari tombol di Key Action Matrix (FR-IB-02)
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('simulation_id') ?? '';
    api
      .get<SimulationOption[]>('/simulations/options/all')
      .then((r) => {
        setSimulations(r.data);
        if (fromQuery && r.data.some((s) => s.simulation_id === fromQuery)) setSimulationId(fromQuery);
      })
      .catch((e) => setMessage(apiErrorMessage(e, 'Gagal memuat simulation')));
  }, []);

  const loadSummary = useCallback(async () => {
    if (!simulationId) return setCurrent(null);
    try {
      setCurrent((await api.get<CurrentSummary>('/key-action-bars/summary', { params: { simulation_id: simulationId } })).data);
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Gagal memuat ringkasan'));
    }
  }, [simulationId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Ganti simulation / file -> preview harus diulang (FR-IB-23)
  function resetPreview() {
    setResult(null);
    setErrors(null);
    setSaved(null);
    setMessage('');
  }
  function chooseSimulation(id: string) {
    setSimulationId(id);
    resetPreview();
  }
  function chooseFile(f: File | null) {
    resetPreview();
    setFile(f);
    if (f) {
      const err = checkXlsxFile(f);
      if (err) setMessage(err);
    }
  }

  function formData() {
    const body = new FormData();
    body.append('simulation_id', simulationId);
    body.append('file', file!);
    return body;
  }

  async function preview() {
    if (!file || checkXlsxFile(file)) return;
    setBusy('preview');
    resetPreview();
    try {
      const res = await api.post<ImportResult>('/key-action-bars/import/preview', formData());
      setResult(res.data);
      if (!res.data.valid) setErrors({ errors: res.data.errors, error_total: res.data.error_total });
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Gagal membaca file'));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!result?.valid || !file) return;
    const deleted = result.summary.bars.total.deleted;
    if (deleted && !confirm(`${deleted} BARS akan dihapus dari simulation ${simulationId}. Lanjutkan?`)) return;
    setBusy('save');
    setMessage('');
    try {
      const res = await api.post<ImportResult>('/key-action-bars/import', formData());
      setSaved(res.data);
      setResult(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      loadSummary();
    } catch (e) {
      const list = axios.isAxiosError(e) ? importErrorsFrom(e.response?.data) : null;
      if (list) {
        setErrors(list);
        setResult(null);
      } else {
        setMessage(apiErrorMessage(e, 'Gagal menyimpan'));
      }
    } finally {
      setBusy('');
    }
  }

  async function download(kind: 'template' | 'export') {
    setBusy('download');
    setDownloading(kind);
    setDownloadError('');
    try {
      if (kind === 'template') {
        await downloadXlsx(
          '/key-action-bars/template',
          simulationId ? { simulation_id: simulationId, format } : { format },
          templateFileName(format),
        );
      } else {
        await downloadXlsx('/key-action-bars/export', { simulation_id: simulationId, format }, exportFileName(simulationId, new Date(), format));
      }
    } catch (e) {
      setDownloadError(await blobErrorMessage(e, 'Gagal mengunduh'));
    } finally {
      setBusy('');
      setDownloading('');
    }
  }

  const simulation = simulations.find((s) => s.simulation_id === simulationId);
  const summaryView = result?.summary ?? saved?.summary;
  const fileError = file ? checkXlsxFile(file) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Import BARS</h1>
          <p className="text-sm text-slate-500">
            Upload BARS &amp; behaviour satu simulation dari Excel. Isi file menggantikan seluruh BARS simulation tersebut.
          </p>
        </div>
        {simulationId && (
          <Link className="btn-light" href={`/dashboard/masters/key-action-matrix?simulation_id=${encodeURIComponent(simulationId)}`}>
            Lihat di Key Action Matrix
          </Link>
        )}
      </div>

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1">Simulation</label>
          <select className="input min-w-[280px]" value={simulationId} onChange={(e) => chooseSimulation(e.target.value)} aria-label="Simulation">
            <option value="">— pilih simulation —</option>
            {simulations.map((s) => (
              <option key={s.simulation_id} value={s.simulation_id}>
                {s.simulation_name ? `${s.simulation_name} (${s.simulation_id})` : s.simulation_id}
              </option>
            ))}
          </select>
        </div>
        {current && (
          <div className="text-sm text-slate-600" aria-live="polite">
            Data saat ini: <b>{current.bars_total}</b> BARS ({BARS_TYPES.map((t) => `${t} ${current.bars[t]}`).join(' · ')}),{' '}
            <b>{current.behaviours}</b> behaviour
          </div>
        )}
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold" htmlFor="bars-format">Format file</label>
            <select
              id="bars-format"
              className="input"
              value={format}
              onChange={(e) => setFormat(e.target.value as FileFormat)}
              title="Format untuk Unduh template & Export data. Saat import, format dikenali otomatis."
            >
              {FILE_FORMATS.map((f) => (
                <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
              ))}
            </select>
            <button className="btn-light" onClick={() => download('template')} disabled={busy !== ''}>
              {downloading === 'template' ? 'Mengunduh…' : 'Unduh template'}
            </button>
            <button className="btn-light" onClick={() => download('export')} disabled={!simulationId || busy !== ''}>
              {downloading === 'export' ? 'Mengunduh…' : 'Export data'}
            </button>
          </div>
          {downloadError && <p className="text-sm text-red-700" role="alert">{downloadError}</p>}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="input max-w-md"
            aria-label="File Excel BARS"
            disabled={!simulationId}
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          <button className="btn-dark" onClick={preview} disabled={!simulationId || !file || !!fileError || busy !== ''}>
            {busy === 'preview' ? 'Membaca…' : 'Preview'}
          </button>
          {!simulationId && <span className="text-sm text-slate-500">Pilih simulation dulu.</span>}
        </div>
        <p className="text-xs text-slate-500">
          File format matriks maupun flat bisa diupload; format dikenali otomatis dari judul kolom. Format matriks:
          weight selalu 1 dan need_ai selalu TRUE.
        </p>
        {message && <p className="text-sm text-red-700" role="alert">{message}</p>}
      </div>

      {saved && (
        <div className="card text-sm text-emerald-800 bg-emerald-50 flex flex-wrap items-center gap-3" role="status">
          Import tersimpan untuk simulation {simulation?.simulation_name ?? simulationId}.
          <Link className="underline" href={`/dashboard/masters/key-action-matrix?simulation_id=${encodeURIComponent(simulationId)}`}>
            Lihat di Key Action Matrix
          </Link>
        </div>
      )}

      {summaryView && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">{saved ? 'Hasil import' : 'Preview'}</h2>
            <span className="text-sm text-slate-500">
              {simulation?.simulation_name ?? simulationId} · {(result ?? saved)?.rows_read} baris dibaca
              {(result ?? saved)?.format && ` · format ${FORMAT_LABEL[(result ?? saved)!.format!].toLowerCase()}`}
            </span>
            {result && result.valid && !hasChanges(result.summary) && (
              <span className="text-sm text-slate-500">Tidak ada perubahan dibanding data saat ini.</span>
            )}
          </div>
          <table className="table max-w-3xl">
            <thead>
              <tr>
                <th></th>
                {COUNT_COLS.map((c) => <th key={c.key} className="text-right">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {BARS_TYPES.map((t) => (
                <tr key={t}>
                  <td>BARS {t}</td>
                  {COUNT_COLS.map((c) => <td key={c.key} className={`text-right ${summaryView.bars[t][c.key] ? c.cls : ''}`}>{summaryView.bars[t][c.key]}</td>)}
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total BARS</td>
                {COUNT_COLS.map((c) => <td key={c.key} className="text-right">{summaryView.bars.total[c.key]}</td>)}
              </tr>
              <tr>
                <td>Behaviour</td>
                {COUNT_COLS.map((c) => <td key={c.key} className={`text-right ${summaryView.behaviours[c.key] ? c.cls : ''}`}>{summaryView.behaviours[c.key]}</td>)}
              </tr>
            </tbody>
          </table>
          {result?.warnings.map((w) => <p key={w} className="text-sm text-amber-700">⚠ {w}</p>)}
          {result?.valid && (
            <div className="flex items-center gap-3">
              <button className="btn-dark" onClick={save} disabled={busy !== ''}>
                {busy === 'save' ? 'Menyimpan…' : 'Simpan'}
              </button>
              {result.summary.bars.total.deleted + result.summary.behaviours.deleted > 0 && (
                <span className="text-sm text-red-700">
                  Data yang tidak ada di file akan dihapus (soft delete).
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {errors && (
        <div className="card space-y-2" role="alert">
          <h2 className="font-semibold text-red-700">
            {errors.error_total} error — perbaiki file lalu Preview ulang
          </h2>
          <div className="overflow-auto max-h-[50vh]">
            <table className="table">
              <thead>
                <tr><th className="w-20">Baris</th><th className="w-40">Kolom</th><th>Pesan</th></tr>
              </thead>
              <tbody>
                {errors.errors.map((e, i) => (
                  <tr key={i}>
                    <td>{e.row ?? '-'}</td>
                    <td className="font-mono text-xs">{e.column ?? '-'}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.error_total > errors.errors.length && (
            <p className="text-sm text-slate-500">Menampilkan {errors.errors.length} dari {errors.error_total} error.</p>
          )}
        </div>
      )}
    </div>
  );
}
