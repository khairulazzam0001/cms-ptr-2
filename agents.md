# agents.md — CMS Data Master (cms-ptr-2)

Dokumen ini untuk AI coding agent yang mengerjakan repo ini. Baca sebelum mengubah kode.
Bahasa komunikasi dengan user: Indonesia.

## 1. Ringkasan aplikasi

CMS admin untuk **Master Assessment Design**: kelola Level, Design, Competency,
Simulation, Assessment Design + relasi detail (competency & simulation per design),
sinkronisasi terjadwal ke Google Sheets, dan download CSV lokal.
Modul **Master Document** (Document Generator): editor rich-text TipTap berhalaman A4,
konten disimpan HTML per halaman. Spesifikasi: `PRD_Document_Generator.md`.
Modul **Upload Document**: upload file HTML read-only ke tabel yang sama
(`read_only = 'document'`, isi 1 baris `page = 0`). Spesifikasi: `PRD_Upload_Document.md`.

**Stack (jangan diganti tanpa persetujuan user):**
- Backend: NestJS 10 + TypeORM 0.3 + MySQL (database `cms_master`), JWT single-admin
- Frontend: Next.js 14 (App Router) + Tailwind + Axios
- Integrasi: `googleapis` (Sheets API v4, Drive API v3), `@nestjs/schedule` (cron)
- Document Generator: TipTap 3.31.4 (frontend, versi dikunci), `sanitize-html` 2.17.0 (backend, dikunci)
- Test: Jest + ts-jest (backend, `*.spec.ts`), Vitest 3 + jsdom (frontend, `*.test.ts`)

## 2. Struktur repo

```
cms-ptr-2/
  agents.md                <- file ini
  README.md                <- panduan user (cara jalan, pola tambah master)
  .gitignore               <- melindungi .env, service-account JSON, log, uploads, build
  backend/                 <- NestJS API, port 3001, global prefix /api
    src/main.ts            <- baris 1 `import 'dotenv/config'` (lihat §4), prefix 'api',
                              ValidationPipe global (whitelist), CORS, serve /uploads
    src/app.module.ts      <- ConfigModule(.env), TypeORM(synchronize:true, DEV saja),
                              ScheduleModule.forRoot(), Auth/Users/Uploads/
                              ExampleMaster/Assessment/Sheets modules
    src/common/dto/pagination.dto.ts   <- PaginationDto(page,limit,search,sortBy,sortDir)
                                          + paginateResponse()
    src/common/decorators/public.decorator.ts <- @Public() untuk route tanpa JWT
    src/modules/auth/      <- POST /api/auth/login, JwtStrategy + jwtSecret() (fail fast),
                              JwtModule.registerAsync, JwtAuthGuard global (APP_GUARD)
    src/modules/users/     <- entity User + UsersService.validate
                              (ensureSingleAdmin = dead code; seed yang dipakai)
    src/modules/uploads/   <- POST /api/uploads & /uploads/gambar (multer disk)
    src/modules/assessment/
      entities.ts          <- Level, Design, Competency, Simulation,
                              AssessmentDesign, AssessmentDesignDetailCompetency,
                              AssessmentDesignDetailSimulation
      dto.ts               <- Query DTO (CompetencyQueryDto, SimulationQueryDto),
                              Create/Update DTO per entity + Add*ToDesignDto
      assessment.service.ts<- semua query (paged, search, counts, available-picker)
      controllers.ts       <- Levels/Designs/Competencies/Simulations/
                              AssessmentDesignsController
      assessment.module.ts
    src/modules/sheets/
      sheets.service.ts    <- Sheets API: status(), collectTables(), syncAll(),
                              exportCsv(tab); kredensial via GOOGLE_SERVICE_ACCOUNT_JSON
                              (inline) ATAU GOOGLE_SERVICE_ACCOUNT_FILE (path)
      drive.service.ts     <- Drive API: upload CSV (NONAKTIF — lihat §6)
      sheets.scheduler.ts  <- cron sheets-sync (SHEETS_CRON) + drive-csv-sync (DRIVE_CRON)
      sheets.controller.ts <- GET /sheets/status, POST /sheets/sync,
                              POST /sheets/sync-drive, GET /sheets/export/:tab
      sheets.module.ts
    src/modules/documents/ <- Master Document: entity (master_document + master_document_content),
                              dto.ts, sanitize.ts (allowlist HTML), documents.service.ts
                              (PUT content transaksional + revision), controller, *.spec.ts
    src/modules/upload-documents/ <- Upload Document: html-file.ts (validasi file + peringatan),
                              service/controller (multer memory storage, maks 2 MB), *.spec.ts
    src/common/decorators/current-user.decorator.ts <- @CurrentUsername() dari JWT (kolom audit)
    src/modules/masters/example-master/ <- TEMPLATE modul master generik (jangan hapus)
    src/database/seed.ts   <- seed admin + data contoh (Level 3, DSG-ALL, 3 competency,
                              4 simulation, design 10001). Jalan via `npm run seed:admin`.
                              Catatan: setiap run me-reset password admin ke ADMIN_PASSWORD.
    .env.example           <- template env (tanpa secret). .env aktif TIDAK di-commit.
  frontend/                <- Next.js admin, port 3000
    src/lib/api.ts         <- axios instance (baseURL NEXT_PUBLIC_API_URL, inject
                              Bearer dari localStorage cms_token, redirect /login saat 401),
                              tipe Paged<T>, helper uploadFile()
    src/app/layout.tsx, globals.css, page.tsx (-> redirect /login)
    src/app/login/page.tsx
    src/app/dashboard/layout.tsx   <- sidebar; daftar menu di konstanta MENUS
    src/app/dashboard/page.tsx
    src/app/dashboard/masters/
      assessment-designs/page.tsx  <- list + modal Add/Edit + View Competency/Simulation
      assessment-designs/[id]/competencies/page.tsx <- list detail + modal picker Add
      assessment-designs/[id]/simulations/page.tsx  <- list detail + totalDuration + picker
                                                       (filter group_simulation_id)
      levels|designs|competencies|simulations/page.tsx <- create + search + delete
                                                          (belum ada Edit & paging)
      sheets-sync/page.tsx <- status scheduler + tombol sync + download CSV per tab
      example-masters/page.tsx <- template UI master generik
      documents/page.tsx           <- list dokumen (search, filter status/aktif, paging, aksi)
      documents/[id]/edit/page.tsx <- editor A4 (autosave, status, preview)
      upload-documents/page.tsx    <- list + modal upload/ganti file/edit, preview, unduh, hapus
    src/lib/document/      <- logika murni Document Generator (diuji Vitest):
                              constants.ts (geometri A4), paginator.ts, measure.ts (ukur DOM),
                              html.ts (split/merge halaman), paste.ts (bersihkan Word/GDocs),
                              headerFooter.ts (token {page}/{pages})
    src/components/document/ <- DocumentEditor, Toolbar, extensions.ts (PageBreak, Indent,
                                DocTable), pagination.ts (dekorasi batas halaman), DocumentPreview,
                                PageHeaderFooter (editor+preview), HeaderFooterPanel
    src/lib/uploadDocument.ts  <- tipe, validasi klien, buildPreviewSrcdoc (CSP + buang meta refresh/base)
    src/components/upload-document/HtmlPreview.tsx <- preview di <iframe sandbox=""> (tanpa izin)
    .env.example           <- NEXT_PUBLIC_API_URL=http://localhost:3001/api
                             (aktif sebagai frontend/.env.local)
```

## 3. Menjalankan (Windows PowerShell)

Prasyarat: Node 24, npm 11, MySQL 9.x running. DB `cms_master` harus ada:
`mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cms_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`

2 terminal terpisah (lebih aman dari background hidden):
```powershell
cd backend; npm install; npm run seed:admin; npm run start:dev   # http://localhost:3001/api
cd frontend; npm install; npm run dev                            # http://localhost:3000/login
```
Login default dev: `admin` / `admin123` (dari ADMIN_USERNAME/ADMIN_PASSWORD saat seed).

Cek cepat: `netstat -ano | findstr "3000 3001"` — keduanya harus LISTENING.
Log dev: `backend/backend-dev.log`, `frontend/frontend-dev.log` (jika dijalankan hidden).

## 4. Konvensi backend (WAJIB diikuti)

- **Primary key string manual** (`@PrimaryColumn({length:50})`, mis. `COMP_DDI_BA`),
  BUKAN auto-increment. Detail memakai id gabungan `${designId}_${childId}`.
- **Soft delete** via kolom `is_deleted` (boolean, default false). Semua query list
  WAJIB filter `is_deleted = false`. Jangan pakai `remove()` TypeORM.
- **Audit**: `created_by/created_date/modified_by/modified_date/is_deleted` di tiap tabel master.
- **List selalu paged**: pakai `PaginationDto` + `paginateResponse()`. Search via helper
  `applySearch()` (LIKE `%search%`). Response: `{ data, meta: {total,page,limit,totalPages} }`.
- **Filter query param WAJIB dideklarasikan di DTO.** ValidationPipe global memakai
  `whitelist: true`, jadi query param yang tidak ada di DTO **dibuang diam-diam**.
  Untuk filter baru: buat `XxxQueryDto extends PaginationDto` di `dto.ts`
  (contoh: `SimulationQueryDto`), pakai di `@Query()` controller & signature service.
  Jangan baca filter via `(q as any).field`.
- **Env & urutan load**: dekorator (`@Module`, `@UseInterceptors`, dll.) dievaluasi saat
  file di-import — sebelum `ConfigModule.forRoot()` jalan. Karena itu `main.ts` baris
  pertama `import 'dotenv/config'`; jangan dihapus/dipindah. Untuk modul yang butuh config,
  prefer `registerAsync`/`useFactory` daripada membaca `process.env` di level modul.
- **Env kosong**: `'' ?? x` menghasilkan `''` — selalu pakai `||` untuk fallback env
  (contoh bug nyata: `GOOGLE_SERVICE_ACCOUNT_JSON ?? ...` membuat baca file dilewati).
- **Auth**: `JwtAuthGuard` global — semua route butuh Bearer kecuali `@Public()`
  (saat ini hanya `POST /auth/login`). Secret hanya dari `jwtSecret()` di `jwt.strategy.ts`
  (dipakai sign + verify). **Jangan tambahkan fallback secret hardcoded**; server memang
  sengaja gagal start bila `JWT_SECRET` kosong.
- **TypeORM `synchronize: true` hanya untuk DEV.** Production: matikan + pakai migration.
  Tambah kolom baru di entity -> tabel teralter otomatis saat restart (dev).
- Env penting: `PORT`, `FRONTEND_URL` (CORS), `DB_*`, `JWT_SECRET`, `JWT_EXPIRES`,
  `ADMIN_USERNAME/PASSWORD` (seed), `UPLOAD_DIR`, `MAX_FILE_MB`, `GOOGLE_*`, `SHEETS_*`, `DRIVE_*`.
  Tambah env baru -> update `backend/.env.example` juga.

## 5. Konvensi frontend (WAJIB diikuti)

- Semua request lewat `api` dari `@/lib/api` (jangan `fetch` mentah) agar token ikut.
- Auth: token di `localStorage['cms_token']`; 401 otomatis redirect `/login`.
- **`useEffect` wajib punya dependency array.** Pola debounce search yang benar:
  `useEffect(() => { const t = setTimeout(() => load(search), 400); return () => clearTimeout(t); }, [search]);`
  Tanpa `[search]`, setiap `setState` memicu re-render -> timer baru -> request API
  tiap 400 ms tanpa henti (bug nyata yang sudah diperbaiki). Effect ini juga menangani
  load awal, jadi jangan tambah `load()` terpisah saat mount.
- Tambah halaman master baru: copy folder `example-masters/` atau halaman sejenis,
  ganti endpoint, daftarkan di `MENUS` pada `dashboard/layout.tsx`.
- Download CSV: `api.get('/sheets/export/'+tab, {responseType:'blob'})` -> trigger `<a download>`.
- Style: class utilitas di `globals.css` (`.card .input .btn .btn-dark .btn-light .table`).

## 5a. Document Generator (Master Document)

- **Konten per halaman**: `PUT /documents/:id/content {revision, pages[]}` mengganti seluruh
  konten dalam 1 transaksi (`SELECT … FOR UPDATE`, cek `revision`, hapus fisik baris konten lama,
  insert baru, `revision+1`, FINAL -> DRAFT). Hapus fisik konten = pengecualian aturan soft delete
  (UNIQUE `document_id,page`); header tetap soft delete. `revision` beda -> 409.
- **ID dokumen unik termasuk yang soft-deleted** (create/duplicate -> 409 "ID sudah dipakai").
- **Sanitasi wajib di backend** (`sanitize.ts`). Atribut penanda (`data-page-break`,
  `data-continued`, `data-split`, `data-repeated`, `data-borderless`) hanya bernilai `"true"`; `start/colspan/rowspan`
  hanya angka. Menambah format di editor = tambah allowlist di sini juga, atau format hilang saat simpan.
- **Pagination**: satu instance editor; `measure.ts` mengukur tinggi blok di DOM -> `paginator.ts`
  (fungsi murni) -> dipakai untuk dekorasi editor, payload simpan (`splitIntoPages`), dan preview.
  Saat dimuat, `mergePages` menyatukan tabel/list/paragraf lanjutan.
- **Paragraf dipecah per baris** (widow/orphan 2 baris): baris diukur malas (`lines()` di
  `measure.ts`, via `getClientRects` + `view.posAtCoords`) hanya bila paragraf tidak muat.
  Unit/fragment paragraf memakai **offset konten ProseMirror** (1 per karakter, 1 per `<br>`);
  `sliceInline` di `html.ts` memotong HTML pada offset yang sama. Di editor, batasnya berupa widget
  `span.pg-line-spacer` (display:block) di awal baris.
- **Header/footer**: 7 kolom di `master_document`, dikirim di `PUT /content` (`header_footer`).
  Dirender `PageHeaderFooter` di margin (overlay per lembar di editor, posisi `i × (A4 + jarak)`),
  teks polos dengan token `{page}`/`{pages}` — jangan dirender sebagai HTML.
- **CSS `.doc-content` di `globals.css` menentukan tinggi blok** — dipakai editor DAN preview.
  Hanya margin-bawah (tanpa margin collapse), font Arial 11pt. Mengubahnya mengubah pembagian halaman.
- Body limit JSON 5 MB (`main.ts` `useBodyParser`); maks 200 halaman, 512 KB/halaman.

## 5b. Upload Document (dokumen HTML read-only)

- Tabel sama dengan Document Generator; pembeda kolom `master_document.read_only`:
  `'document'` = upload, `NULL` = editor. **Setiap query modul documents wajib `read_only IS NULL`**,
  modul upload-documents wajib `read_only = 'document'` (dokumen modul lain -> 404). ID unik lintas keduanya.
- Isi HTML disimpan **utuh tanpa sanitasi** di 1 baris `master_document_content` `page = 0`
  (`page_count = 0`, status selalu FINAL, ganti file = update baris itu + `revision+1`).
- Karena tidak disanitasi: render HANYA lewat `buildPreviewSrcdoc()` di `<iframe sandbox="">` tanpa
  token izin apa pun. Jangan `dangerouslySetInnerHTML`, jangan tambah `allow-scripts`/`allow-same-origin`.
  Unduhan: attachment + `nosniff`. File tidak pernah ditulis ke `/uploads` (publik).
- Upload: multer memory storage, `MAX_HTML_BYTES` 2 MB (terpisah dari `MAX_FILE_MB`), `.html/.htm`, UTF-8.

## 6. Sinkronisasi Google (Sheets jalan, Drive mati)

- **Sheets (AKTIF jika dikonfigurasi)**: `SheetsService.collectTables()` = 1 sumber data
  untuk sync Sheets DAN export CSV (jangan duplikasi query). Tab: levels, designs,
  competencies, simulations, assessment_designs, design_competencies, design_simulations.
- Env: `GOOGLE_SPREADSHEET_ID` (ID saja, bukan URL!), kredensial via
  `GOOGLE_SERVICE_ACCOUNT_JSON` (satu baris) atau `GOOGLE_SERVICE_ACCOUNT_FILE`
  (default `./google-service-account.json`), `SHEETS_SYNC_ENABLED`, `SHEETS_CRON`
  (default `0 * * * *`). Syarat Google: Sheets API enabled + spreadsheet di-share
  ke `client_email` sebagai Editor.
- **Drive CSV (NONAKTIF, `DRIVE_SYNC_ENABLED=false`)**: upload file via Service Account
  ke akun personal DIBLOKIR Google (`403 storageQuotaExceeded`, kuota SA = 0) meski
  folder sudah di-share. Jangan "perbaiki" dengan scope penuh — solusinya butuh
  Shared Drive (Workspace) atau OAuth user. Pengganti resmi: tombol download CSV lokal.
- Daftar endpoint: `GET /sheets/status`, `POST /sheets/sync`,
  `POST /sheets/sync-drive`, `GET /sheets/export/:tab` (CSV + BOM UTF-8 untuk Excel).

## 7. Gotcha yang sudah terbukti (jangan ulangi)

1. `@nestjs/config` HARUS versi `^3.2.0` (Nest 10). Versi terbaru butuh Nest 11 dan
   `npm install` gagal eresolve.
2. `nest start --watch` kompilasi awal bisa >60 detik — jangan dikira hang; tunggu
   log "Nest application successfully started".
3. `.env` aktif tidak ada di repo fresh — salin dari `.env.example` lalu isi
   `DB_PASS`, `JWT_SECRET` dkk. Service account JSON JANGAN di-commit (sudah di `.gitignore`).
4. Frontend mati diam-diam = port 3000 tidak LISTENING (backend 3001 tidak terdampak).
5. ID Google dari URL harus diekstrak: spreadsheet `/d/<ID>/edit`, folder `/folders/<ID>`.
   Menempel URL utuh membuat API Google gagal.
6. CSV export memakai `\r\n` + BOM — jangan hilangkan (Excel Windows butuh).
7. Query param filter "tidak berefek" = belum dideklarasikan di Query DTO (lihat §4).
8. Ganti `JWT_SECRET` lalu semua login 401 = secret dibaca sebelum `.env` dimuat.
   Sudah diperbaiki via `import 'dotenv/config'` + `registerAsync`; jangan regresi.
9. Network tab penuh request berulang = `useEffect` tanpa dependency array (lihat §5).
10. `sanitize-html` >= 2.18 memakai `htmlparser2` ESM-only -> Jest gagal load. Tetap di 2.17.0.
11. Vitest 5 butuh `@types/node` >= 22 (proyek: 20) -> pakai Vitest 3. TipTap butuh
    `@types/react-dom@18` eksplisit agar npm tidak menarik v19 (ERESOLVE).
12. Lembar A4 (794 px) melebarkan `<main>` -> `main` di `dashboard/layout.tsx` wajib `min-w-0`.
13. Jangan `npm run build` frontend saat `npm run dev` jalan (menimpa `.next`); cukup `npx tsc --noEmit`.
14. Respons 413 (body > 5 MB) berasal dari express = HTML, bukan JSON; frontend pakai `apiErrorMessage`.

## 8. Known issues (backlog — belum diperbaiki, jangan dianggap fitur)

Prioritas kira-kira dari atas. Kerjakan hanya bila diminta user.
- **Keamanan**: upload tanpa filter tipe file (`.html/.svg` bisa diunggah) dan `/uploads`
  diserve publik tanpa auth; form login pre-fill `admin/admin123`; `/dashboard` tidak
  diproteksi di frontend (tidak ada cek token / middleware); upload tanpa file -> 500.
- **Soft delete**: create ulang id yang sudah soft-deleted -> 409 (`findOne` tidak cek
  `is_deleted`); competency/simulation yang dihapus masih muncul di detail design & count;
  hapus assessment design tidak ikut menandai detail-nya.
- **Error handling**: update/get id tak ada -> 500 (`findOneOrFail`), seharusnya 404.
  Frontend tidak menampilkan error API (tanpa try/catch / toast).
- **Data**: id detail `${designId}_${childId}` bisa > varchar(50); `totalDuration` hanya
  menjumlah halaman aktif; `sequence = count+1` bisa duplikat setelah delete;
  `created_by/modified_by` hardcoded `'admin'`.
- **UI**: halaman Level/Design/Competency/Simulation belum ada Edit & paging; `level_id`
  input teks bebas (bukan dropdown); "Detail" simulation masih `alert(JSON)`.
- **Lain**: `example-masters/page.tsx:85` error tsc (`boolean | null`); example-master
  `sortBy/sortDir` tidak divalidasi; N+1 count di list assessment design;
  `UsersService.ensureSingleAdmin` dead code.

## 9. Verifikasi setelah mengubah kode

```powershell
cd backend; npm run build                      # harus 0 error
cd backend; npm test                           # Jest (documents, sanitize, upload-documents)
cd frontend; npx tsc --noEmit                  # cek tipe (lihat known issue example-masters)
cd frontend; npm test                          # Vitest (paginator, split/merge, paste, upload preview)
# lalu dengan server jalan + sudah login:
# POST /api/auth/login -> token
# GET  /api/assessment-designs?limit=5 (Bearer) -> meta + data
# GET  /api/simulations?group_simulation_id=CSR (Bearer) -> hanya group CSR
# POST /api/sheets/sync (Bearer) -> summary 7 tab (butuh kredensial Google)
# GET  /api/sheets/export/simulations (Bearer) -> CSV
```
Untuk uji tanpa mengganggu server dev: `$env:PORT=3101; $env:SHEETS_SYNC_ENABLED='false'; node dist/main`
(env proses tidak ditimpa `.env`). Matikan lagi setelah selesai.
