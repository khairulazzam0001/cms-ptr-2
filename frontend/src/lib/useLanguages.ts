'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

export type Language = {
  language_id: string;
  language_name: string;
  native_name?: string | null;
};

// Daftar bahasa target dari master_language (dipakai fitur terjemahan)
export function useLanguages() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get<Language[]>('/languages/options/all')
      .then((res) => {
        if (!cancelled) setLanguages(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat daftar bahasa');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { languages, error };
}
