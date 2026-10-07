# CMS Data Master

Stack sesuai pilihan:
- **Backend:** NestJS 10 + TypeORM + MySQL + JWT (single admin) + Upload dokumen/gambar
- **Frontend:** Next.js 14 (App Router) + Tailwind + Axios
- **Fitur per modul:** CRUD + Search + Paging + Upload file

## Struktur
```
cms-ptr-2/
  backend/  -> NestJS API (port 3001, prefix /api)
  frontend/ -> Next.js Admin (port 3000)
```

## Cara jalan (dev)

1. Siapkan MySQL, buat database `cms_master`.
2. Backend:
```bash
cd backend
cp .env.example .env
npm install
npm run seed:admin
npm run start:dev
```
Test: POST http://localhost:3001/api/auth/login {username,password}

3. Frontend:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Buka http://localhost:3000/login

## Pola tambah master baru
Backend: copy `backend/src/modules/masters/example-master/` -> misal `products/`,
rename entity/dto/service/controller/module, daftarkan di `app.module.ts`.
Frontend: copy `frontend/src/app/dashboard/masters/example-masters/page.tsx`
-> folder baru, ganti endpoint `/example-masters` -> `/products`,
tambah menu di `dashboard/layout.tsx`.

## Upload
- POST `/api/uploads` (key `file`) untuk dokumen umum
- POST `/api/uploads/gambar` untuk gambar
- Response: `{ url, filename }` — simpan `url` ke kolom `dokumenUrl`
- File diserve di `GET /uploads/...`

## Modul Master Assessment Design (dari Lofi + ERD)
Backend `backend/src/modules/assessment/`:
- `entities.ts`: Level, Design, Competency, Simulation, AssessmentDesign, DetailCompetency, DetailSimulation
- Endpoints:
  - `GET/POST /api/levels`, `GET /api/levels/options/all`
  - `GET/POST /api/designs`, `GET /api/designs/options/all`
  - `GET/POST /api/competencies`
  - `GET/POST /api/simulations`, `GET /api/simulations/groups/all`
  - `GET/POST /api/assessment-designs` (list ada `competency_count`, `simulation_count`)
  - `GET /api/assessment-designs/:id/competencies` + `/competencies-available` + `POST` + `DELETE`
  - `GET /api/assessment-designs/:id/simulations` (+`totalDuration`) + `/simulations-available?group_simulation_id=` + `POST` + `DELETE`
- Seed: `npm run seed:admin` isi Level 3, DSG-ALL, 3 competency, 4 simulation, design 10001/DESIGN ALL.

Frontend:
- `/dashboard/masters/assessment-designs` — List + Search + Add/Edit modal (id, Name, Level dropdown, Design dropdown) + View Competency/Simulation + Edit/Delete
- `/dashboard/masters/assessment-designs/[id]/competencies` — View + Search + Delete + Add picker
- `/dashboard/masters/assessment-designs/[id]/simulations` — View + Search + Detail/Delete + Add picker (filter group simulation + total duration)
- `/dashboard/masters/levels|designs|competencies|simulations` — CRUD sederhana pengisi dropdown.

> Update: `master_simulation` sudah disesuaikan ke ERD asli (simulation_id, simulation_name, simulation_desc, duration, channel_name, group_simulation_id, status). Filter group pakai `?group_simulation_id=`.
