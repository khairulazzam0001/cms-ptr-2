'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiErrorMessage } from '@/lib/api';
import { UploadDocumentDetail, buildPreviewSrcdoc, formatBytes } from '@/lib/uploadDocument';

// Preview dokumen HTML upload (FR-UD-40..43). HTML tak tepercaya: HANYA lewat iframe sandbox=""
// (tanpa allow-scripts / allow-same-origin / allow-popups) + CSP; tidak pernah innerHTML ke DOM CMS.
export default function HtmlPreview({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [data, setData] = useState<UploadDocumentDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<UploadDocumentDetail>(`/upload-documents/${encodeURIComponent(documentId)}`);
      setData(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Gagal memuat preview'));
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const srcDoc = useMemo(() => (data ? buildPreviewSrcdoc(data.content_html) : ''), [data]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800/95" role="dialog" aria-modal="true" aria-label="Preview dokumen HTML">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-900 text-white">
        <span className="font-semibold truncate">{data ? data.document_name : 'Preview'}</span>
        {data && <span className="text-xs text-slate-300 font-mono">{data.document_id} · {formatBytes(data.size_bytes)}</span>}
        <span className="text-xs text-slate-400">Script &amp; resource eksternal tidak dijalankan di preview</span>
        <button className="btn-light !py-1 !text-slate-900 ml-auto" onClick={onClose} aria-label="Tutup preview (Esc)">Tutup</button>
      </div>
      <div className="flex-1 p-4 min-h-0">
        {error && (
          <div className="card max-w-md mx-auto space-y-2">
            <p className="text-red-700" role="alert">{error}</p>
            <button className="btn-light" onClick={load}>Coba lagi</button>
          </div>
        )}
        {!data && !error && <p className="text-center text-slate-300">Memuat…</p>}
        {data && (
          <iframe
            title={`Preview ${data.document_id}`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            className="w-full h-full bg-white rounded"
          />
        )}
      </div>
    </div>
  );
}
