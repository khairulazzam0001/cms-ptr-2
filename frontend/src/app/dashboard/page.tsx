export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="card">
        <p>Selamat datang di CMS Data Master.</p>
        <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
          <li>Login memakai single admin (JWT).</li>
          <li>Buka menu “Contoh Master” untuk pola CRUD + Search + Paging + Upload.</li>
          <li>Kirim struktur tabel master-mu, nanti saya generate-kan modulnya.</li>
        </ol>
      </div>
    </div>
  );
}
