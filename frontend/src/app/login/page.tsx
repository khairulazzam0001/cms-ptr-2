'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('cms_token', res.data.access_token);
      router.push('/dashboard');
    } catch {
      setErr('Username / password salah');
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h1 className="text-xl font-bold">Login CMS</h1>
        <p className="text-sm text-slate-500">Single admin — JWT</p>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-dark w-full">Masuk</button>
      </form>
    </main>
  );
}
