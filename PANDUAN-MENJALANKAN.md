# Panduan Menyalakan Server CMS (untuk User)

Dokumen ini menjelaskan cara menyalakan backend & frontend CMS secara mandiri,
langkah demi langkah. Ikuti urutannya — backend dulu, baru frontend.

Lokasi aplikasi: `D:\My-dev\GITHUB\cms-ptr-2`

---

## A. Yang perlu disiapkan (sekali saja)

1. **Node.js** terinstall. Cek dengan buka PowerShell lalu ketik:
   ```powershell
   node -v; npm -v
   ```
   Harus muncul nomor versi (misal `v24.x` dan `11.x`). Kalau error, install dulu
   dari https://nodejs.org (pilih versi LTS).
2. **MySQL** sedang berjalan.
3. File `backend\.env` sudah ada dan `DB_PASS` sudah benar.
   (Kalau belum ada: `Copy-Item backend\.env.example backend\.env`, lalu isi DB_PASS.)
4. Database `cms_master` sudah dibuat (sekali saja):
   ```powershell
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cms_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```
   Ketik password MySQL saat diminta.

---

## B. Menyalakan BACKEND (wajib pertama)

1. Buka **PowerShell baru** (klik Start → ketik `PowerShell` → Enter).
2. Masuk ke folder backend dan nyalakan:
   ```powershell
   cd D:\My-dev\GITHUB\cms-ptr-2\backend
   npm run start:dev
   ```
   Saat pertama kali di komputer baru, jalankan dulu (sekali saja):
   ```powershell
   npm install
   npm run seed:admin
   ```
3. Tunggu sampai muncul tulisan:
   ```
   Nest application successfully started
   Backend CMS jalan di http://localhost:3001/api
   ```
   (Kompilasi pertama bisa 1–2 menit — tunggu, jangan ditutup.)
4. **Jangan tutup jendela ini.** Biarkan terbuka selama aplikasi dipakai.
   Kalau tulisan error merah muncul, lihat bagian E di bawah.

> Backend = mesin data. Alamatnya `http://localhost:3001/api`.
> Tidak perlu dibuka di browser — cukup pastikan tulisannya "successfully started".

---

## C. Menyalakan FRONTEND (setelah backend jalan)

1. Buka **PowerShell kedua yang baru** (jendela terpisah dari backend).
2. Masuk ke folder frontend dan nyalakan:
   ```powershell
   cd D:\My-dev\GITHUB\cms-ptr-2\frontend
   npm run dev
   ```
   Saat pertama kali di komputer baru, jalankan dulu (sekali saja):
   ```powershell
   npm install
   ```
3. Tunggu sampai muncul tulisan:
   ```
   Ready in ...
   ```
4. **Jangan tutup jendela ini juga.** Jadi total ada **2 jendela PowerShell terbuka**:
   satu untuk backend, satu untuk frontend.

---

## D. Membuka aplikasi & login

1. Buka browser (Chrome/Edge) ke alamat:
   ```
   http://localhost:3000/login
   ```
2. Login dengan:
   - Username: `admin`
   - Password: `admin123`
3. Setelah masuk kamu akan melihat Dashboard dengan menu:
   Assessment Design, Master Level, Master Design, Master Competency,
   Master Simulation, Sheets Sync.

> Urutan penting: backend (B) harus jalan DULU sebelum frontend (C) dibuka.
> Kalau halaman login error / tidak bisa login, hampir pasti backend belum jalan.

---

## E. Cara cek & masalah umum

**Cek cepat (di PowerShell mana saja):**
```powershell
netstat -ano | findstr "3000 3001"
```
- Harus ada baris `3000 ... LISTENING` (frontend) dan `3001 ... LISTENING` (backend).
- Kalau `3000` hilang → frontend mati → ulangi langkah C.
- Kalau `3001` hilang → backend mati → ulangi langkah B.

| Gejala | Penyebab & solusi |
|---|---|
| `npm` tidak dikenal | Node.js belum terinstall / PowerShell dibuka sebelum install. Install Node.js, tutup-buka PowerShell lagi. |
| Backend: `Access denied` / `Unknown database` | Password DB salah atau database belum dibuat. Cek `DB_PASS` di `backend\.env`, ulangi langkah A.4. |
| Backend: `Port 3001 already in use` | Ada backend lama masih jalan. Cari dan matikan: `Get-Process node \| Stop-Process -Force`, lalu ulangi langkah B. |
| Browser: halaman tidak bisa dibuka | Frontend belum jalan atau belum selesai compile. Lihat jendela frontend, tunggu tulisan `Ready`. |
| Login gagal padahal admin/admin123 | Backend belum jalan, atau database di-reset. Pastikan backend "successfully started"; kalau perlu jalankan `npm run seed:admin` di folder backend (backend harus dimatikan dulu dengan Ctrl+C). |
| Sinkronisasi Google gagal | Kredensial/belum share. Lihat halaman Sheets Sync untuk statusnya. Aplikasi tetap bisa dipakai tanpa Google. |

---

## F. Mematikan server (selesai memakai)

1. Klik jendela PowerShell backend → tekan `Ctrl+C` → tutup jendela.
2. Klik jendela PowerShell frontend → tekan `Ctrl+C` → tutup jendela.

## G. Pemakaian harian (ringkas)

Setiap mau memakai aplikasi:
1. Buka PowerShell 1 → `cd D:\My-dev\GITHUB\cms-ptr-2\backend` → `npm run start:dev` → tunggu "successfully started".
2. Buka PowerShell 2 → `cd D:\My-dev\GITHUB\cms-ptr-2\frontend` → `npm run dev` → tunggu "Ready".
3. Buka `http://localhost:3000/login` → login `admin` / `admin123`.
4. Selesai: `Ctrl+C` di kedua jendela.
