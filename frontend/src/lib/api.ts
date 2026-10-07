import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('cms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('cms_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// Pesan error dari respons API (NestJS: message string | string[])
export function apiErrorMessage(err: unknown, fallback = 'Terjadi kesalahan'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Tidak dapat terhubung ke server';
    if (err.response.status === 413) return 'Ukuran dokumen terlalu besar';
    const msg = (err.response.data as { message?: unknown } | undefined)?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

export type Paged<T> ={ data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };

export async function uploadFile(file: File, kind: 'dokumen' | 'gambar' = 'dokumen') {
  const form = new FormData();
  form.append('file', file);
  const url = kind === 'gambar' ? '/uploads/gambar' : '/uploads';
  const res = await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data as { url: string; filename: string };
}
