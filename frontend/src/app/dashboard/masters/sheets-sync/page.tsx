'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type SheetsStatus = {
  enabled: boolean; spreadsheetIdSet: boolean; credentialsSet: boolean;
  cron: string; lastSyncAt: string | null; lastSummary: { tab: string; rows: number }[];
};
type DriveStatus = {
  enabled: boolean; folderIdSet: boolean; credentialsSet: boolean;
  cron: string; lastSyncAt: string | null; lastSummary: { file: string; rows: number; action: string }[];
};

export default function SheetsSyncPage() {
  const [st, setSt] = useState<SheetsStatus | null>(null);
  const [drv, setDrv] = useState<DriveStatus | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyDrive, setBusyDrive] = useState(false);

  async function load() {
    const r = await api.get('/sheets/status');
    setSt(r.data.sheets ?? r.data);
    setDrv(r.data.drive ?? null);
  }
  useEffect(() => { load(); }, []);

  async function syncNow() {
    setBusy(true); setMsg('');
    try {
      const r = await api.post('/sheets/sync');
      setMsg(`Sheets sync OK: ${r.data.summary.map((s: any) => `${s.tab}=${s.rows}`).join(', ')}`);
      load();
    } catch (e: any) {
      setMsg(`Gagal: ${e?.response?.data?.message ?? e?.message ?? 'unknown error'}`);
    } finally { setBusy(false); }
  }

  async function downloadCsv(tab: string) {
    const r = await api.get(`/sheets/export/${tab}`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${tab}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const TABS = ['levels', 'designs', 'competencies', 'simulations', 'assessment_designs', 'design_competencies', 'design_simulations'];

  async function syncDriveNow() {
    setBusyDrive(true); setMsg('');
    try {
      const r = await api.post('/sheets/sync-drive');
      setMsg(`Drive CSV sync OK: ${r.data.summary.map((s: any) => `${s.file} (${s.action})`).join(', ')}`);
      load();
    } catch (e: any) {
      setMsg(`Gagal: ${e?.response?.data?.message ?? e?.message ?? 'unknown error'}`);
    } finally { setBusyDrive(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Google Sheets & Drive Sync</h1>
      <div className="card space-y-2">
        <h2 className="font-bold">Google Sheets</h2>
        <p className="text-sm">Scheduler mengirim <b>semua master</b> (levels, designs, competencies, simulations, assessment_designs, design_competencies, design_simulations — 1 tab per tabel) ke spreadsheet sesuai cron.</p>
        <ul className="text-sm list-disc ml-5">
          <li>Scheduler aktif: <b>{st ? (st.enabled ? 'YA' : 'TIDAK') : '...'}</b> (SHEETS_SYNC_ENABLED)</li>
          <li>Spreadsheet ID terisi: <b>{st ? (st.spreadsheetIdSet ? 'YA' : 'BELUM') : '...'}</b></li>
          <li>Kredensial terisi: <b>{st ? (st.credentialsSet ? 'YA' : 'BELUM') : '...'}</b></li>
          <li>Cron: <code>{st?.cron}</code></li>
          <li>Sync terakhir: {st?.lastSyncAt ?? '-'}</li>
        </ul>
        {st?.lastSummary?.length ? (
          <p className="text-sm">Hasil terakhir: {st.lastSummary.map((s) => `${s.tab}=${s.rows}`).join(', ')}</p>
        ) : null}
        <button className="btn-dark" disabled={busy} onClick={syncNow}>
          {busy ? 'Syncing...' : 'Sync Sheets Sekarang'}
        </button>
      </div>

      <div className="card space-y-2">
        <h2 className="font-bold">Google Drive (file CSV)</h2>
        <p className="text-sm">Scheduler generate <b>7 file CSV</b> (<code>levels.csv</code>, <code>designs.csv</code>, <code>competencies.csv</code>, <code>simulations.csv</code>, <code>assessment_designs.csv</code>, <code>design_competencies.csv</code>, <code>design_simulations.csv</code>) dan upload ke folder Drive — file lama dengan nama sama di-<b>overwrite</b>.</p>
        <ul className="text-sm list-disc ml-5">
          <li>Scheduler aktif: <b>{drv ? (drv.enabled ? 'YA' : 'TIDAK') : '...'}</b> (DRIVE_SYNC_ENABLED)</li>
          <li>Folder ID terisi: <b>{drv ? (drv.folderIdSet ? 'YA' : 'BELUM') : '...'}</b></li>
          <li>Kredensial terisi: <b>{drv ? (drv.credentialsSet ? 'YA' : 'BELUM') : '...'}</b></li>
          <li>Cron: <code>{drv?.cron}</code></li>
          <li>Sync terakhir: {drv?.lastSyncAt ?? '-'}</li>
        </ul>
        {drv?.lastSummary?.length ? (
          <p className="text-sm">Hasil terakhir: {drv.lastSummary.map((s) => `${s.file} (${s.action})`).join(', ')}</p>
        ) : null}
        <button className="btn-dark" disabled={busyDrive} onClick={syncDriveNow}>
          {busyDrive ? 'Uploading...' : 'Upload CSV Sekarang'}
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="font-bold">Download CSV Lokal</h2>
        <p className="text-sm">Unduh data master sebagai file CSV langsung dari aplikasi (tanpa Google, tanpa batasan kuota). File-file ini juga bisa kamu upload manual ke folder Drive.</p>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t} className="btn-light" onClick={() => downloadCsv(t)}>{t}.csv</button>
          ))}
        </div>
      </div>

      <div className="card text-sm space-y-1">
        <h2 className="font-bold">Checklist kredensial</h2>
        <ol className="list-decimal ml-5">
          <li>Buat Service Account + download JSON key di Google Cloud Console.</li>
          <li>Enable <b>Google Sheets API</b> dan <b>Google Drive API</b> di project yang sama.</li>
          <li>Share spreadsheet (Editor) dan folder Drive (Content manager/Editor) ke email service account.</li>
          <li>Isi <code>GOOGLE_SPREADSHEET_ID</code> / <code>GOOGLE_DRIVE_FOLDER_ID</code> + JSON key di <code>backend/.env</code>, set <code>SHEETS_SYNC_ENABLED</code> / <code>DRIVE_SYNC_ENABLED=true</code>, restart backend.</li>
        </ol>
      </div>
    </div>
  );
}
