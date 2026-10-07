'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const MENUS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/masters/assessment-designs', label: 'Assessment Design' },
  { href: '/dashboard/masters/levels', label: 'Master Level' },
  { href: '/dashboard/masters/designs', label: 'Master Design' },
  { href: '/dashboard/masters/competencies', label: 'Master Competency' },
  { href: '/dashboard/masters/simulations', label: 'Master Simulation' },
  { href: '/dashboard/masters/documents', label: 'Master Document' },
  { href: '/dashboard/masters/upload-documents', label: 'Upload Document' },
  { href: '/dashboard/masters/sheets-sync', label: 'Sheets Sync' },
  { href: '/dashboard/masters/example-masters', label: 'Contoh Master' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  function logout() {
    localStorage.removeItem('cms_token');
    router.push('/login');
  }
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-white p-4 space-y-4">
        <h2 className="font-bold text-lg">CMS Master</h2>
        <nav className="space-y-1">
          {MENUS.map((m) => (
            <Link key={m.href} href={m.href} className="block px-3 py-2 rounded hover:bg-slate-700">
              {m.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="btn-light w-full !text-slate-900">Logout</button>
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
