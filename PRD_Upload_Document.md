# PRD — Upload Document (Dokumen HTML read-only)

| | |
|---|---|
| Produk | CMS Data Master (cms-ptr-2) |
| Modul | Upload Document: upload file HTML ke `master_document` sebagai dokumen read-only |
| Status | Disetujui — Fase 1–2 terimplementasi (2026-10-07) |
| Tanggal | 2026-10-07 |
| Terkait | `PRD_Document_Generator.md` (tabel `master_document` / `master_document_content` yang sama) |
| Stack | Backend NestJS 10 + TypeORM + MySQL · Frontend Next.js 14 + Tailwind + Axios (tanpa dependensi baru) |

---

## 1. Latar Belakang & Tujuan

Sebagian dokumen sudah tersedia sebagai file HTML jadi (dibuat di luar CMS). Admin perlu
menyimpannya ke CMS **apa adanya** tanpa diketik ulang di editor A4. Dokumen ini disimpan
di tabel yang sama dengan Document Generator agar dapat diambil lewat API dengan cara yang sama,
tetapi bersifat **read-only**: isinya hanya bisa diganti dengan meng-upload file baru, tidak bisa
diedit di editor.

**Tujuan**
1. Admin dapat meng-upload file `.html`/`.htm` dari menu terpisah **Upload Document**.
2. Header dokumen tersimpan di `master_document` dengan `read_only = 'document'`.
3. Isi HTML tersimpan **utuh** di `master_document_content` sebagai **satu baris** dengan `page = 0`.
4. Admin dapat melihat preview, mengunduh, mengganti file, mengubah nama/deskripsi/aktif, dan menghapus.
5. Script di dalam HTML tidak pernah dijalankan oleh CMS.

**Metrik keberhasilan**
- Preview menampilkan HTML sesuai aslinya (CSS inline/`<style>` tetap berlaku).
- File yang diunduh identik byte-per-byte dengan isi tersimpan.
- Tidak ada script dari file upload yang tereksekusi, dan tidak ada request ke luar CMS saat preview.

## 2. Ruang Lingkup

### 2.1 Termasuk
- Menu baru **Upload Document**: list, upload baru, ganti file, preview, unduh, edit header, hapus.
- Kolom baru `master_document.read_only`.
- Pemisahan data: dokumen upload tidak tampil dan tidak bisa diubah lewat menu/API Master Document (editor).

### 2.2 Tidak termasuk
- Mengedit isi HTML di CMS (editor A4 atau editor kode).
- Pagination A4, header/footer, status DRAFT/FINAL untuk dokumen upload.
- Konversi HTML ke format editor TipTap, atau sebaliknya.
- Upload format lain (PDF, DOCX, ZIP), upload banyak file sekaligus, aset terpisah (gambar/CSS eksternal).
- Riwayat versi file. Ganti file menimpa isi lama.

## 3. Pengguna

Single admin (login JWT yang sudah ada). Semua endpoint di balik `JwtAuthGuard` global.

## 4. User Stories

| ID | Sebagai admin, saya ingin… | Supaya… |
|---|---|---|
| UD-01 | meng-upload file HTML dengan `document_id` dan nama | dokumen HTML tersimpan di CMS tanpa diketik ulang |
| UD-02 | melihat preview HTML yang sudah di-upload | memastikan isinya benar |
| UD-03 | mengunduh kembali file HTML | memakai/memeriksa file aslinya |
| UD-04 | mengganti file dokumen | memperbarui isi tanpa membuat dokumen baru |
| UD-05 | mengubah nama, deskripsi, dan status aktif | data header tetap rapi |
| UD-06 | mencari, memfilter, dan menghapus dokumen upload | daftar tetap rapi |

## 5. Data Model

### 5.1 Perubahan `master_document`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `read_only` | varchar(20) NULL, default NULL | `'document'` = dokumen hasil upload HTML (read-only). `NULL` = dokumen dari editor (Document Generator). |

Nilai kolom lain untuk dokumen upload:

| Kolom | Nilai |
|---|---|
| `document_id` | diisi manual, aturan sama: ≤ 50 karakter, huruf/angka/`-`/`_`, unik **termasuk yang sudah dihapus dan lintas kedua modul** |
| `document_name`, `document_desc`, `is_active` | dari form, sama seperti dokumen biasa |
| `status` | selalu `'FINAL'` (dokumen upload dianggap siap dipakai; tidak berubah saat ganti file) |
| `page_count` | `0` (dokumen upload tidak berhalaman A4; isi di `page = 0`) |
| `revision` | `0` saat dibuat, naik +1 setiap ganti file |
| `header_*`, `footer_*`, `hide_header_footer_first_page` | dibiarkan default, tidak dipakai |
| kolom audit | `created_by`/`modified_by` dari JWT; soft delete via `is_deleted` |

### 5.2 Isi di `master_document_content`

- Tepat **1 baris** per dokumen upload: `page = 0`, `content_html` = isi file **utuh** (termasuk
  `<!doctype>`, `<head>`, `<style>`; tanpa sanitasi), disimpan sebagai teks UTF-8.
- Ganti file: baris `page = 0` di-update (atau dihapus lalu di-insert ulang) dalam satu transaksi;
  jumlah baris tetap 1. UNIQUE (`document_id`, `page`) yang sudah ada menjamin tidak ada baris ganda.
- Kolom `content_html` (`mediumtext`, maks 16 MB) cukup untuk batas file 2 MB.

### 5.3 Pemisahan dari Document Generator
- `page = 0` hanya dipakai dokumen upload; dokumen editor tetap `page` 1..n.
- Semua query/endpoint Master Document (`/api/documents`) hanya memproses `read_only IS NULL`.
  Dokumen upload diperlakukan seperti tidak ada di modul itu (404), termasuk `PUT /content`,
  `finalize`, dan `duplicate`.
- Endpoint Upload Document (`/api/upload-documents`) hanya memproses `read_only = 'document'`.

## 6. Kebutuhan Fungsional

### 6.1 List — `/dashboard/masters/upload-documents`
- **FR-UD-01** Menu sidebar **Upload Document**, tepat di bawah **Master Document**.
- **FR-UD-02** Tabel kolom: ID, Nama, Aktif, Ukuran file, Terakhir diubah (+ oleh), Aksi.
- **FR-UD-03** Search (debounce 400 ms) pada `document_id`, `document_name`, `document_desc`;
  filter Aktif (Semua/Aktif/Nonaktif); paging 10/halaman ("Halaman x / y — Total n").
- **FR-UD-04** Aksi per baris: **Preview**, **Unduh**, **Ganti file**, **Edit**, **Hapus** (konfirmasi).
- **FR-UD-05** Tombol **+ Upload Dokumen**. Empty state menampilkan ajakan upload.
- **FR-UD-06** Semua error API ditampilkan ke admin; input form tidak hilang saat gagal.

### 6.2 Upload Baru
- **FR-UD-10** Modal: `document_id` (wajib), `document_name` (wajib, ≤ 150), `document_desc` (opsional),
  file (wajib). Nama dokumen boleh terisi otomatis dari nama file (tanpa ekstensi) bila masih kosong.
- **FR-UD-11** Validasi file (klien dan server; server yang menentukan):
  - ekstensi `.html` atau `.htm`;
  - ukuran ≤ **2 MB**;
  - tidak kosong, teks **UTF-8 valid** (BOM UTF-8 dibuang), tidak mengandung byte NUL;
  - memuat minimal satu tag HTML.
- **FR-UD-12** Berhasil → 201, dokumen muncul di list. ID bentrok (termasuk yang terhapus atau yang
  dipakai dokumen editor) → 409 "ID sudah dipakai".
- **FR-UD-13** Setelah upload, tampilkan peringatan informatif (tidak menolak) bila file memuat
  `<script>`, event handler `on*`, atau referensi eksternal (`http://`, `https://`, `//`) karena
  bagian tersebut tidak berjalan/dimuat di preview CMS.

### 6.3 Ganti File
- **FR-UD-20** Aksi **Ganti file** membuka modal pilih file (validasi sama dengan FR-UD-11).
- **FR-UD-21** Isi baris `page = 0` diganti dalam satu transaksi; `revision + 1`; `modified_by/date`
  diperbarui; status tetap `FINAL`.
- **FR-UD-22** Konfirmasi sebelum menimpa: "Isi lama akan diganti dan tidak bisa dikembalikan."

### 6.4 Edit Header
- **FR-UD-30** Modal edit `document_name`, `document_desc`, `is_active`. `document_id` tidak dapat diubah.

### 6.5 Preview
- **FR-UD-40** Modal layar penuh, HTML dirender di dalam **`<iframe sandbox>` tanpa token izin**
  (tanpa `allow-scripts`, tanpa `allow-same-origin`): script, form, popup, dan navigasi tidak berjalan.
- **FR-UD-41** Isi diberikan lewat `srcdoc` dengan **Content-Security-Policy** yang disisipkan di awal
  dokumen: `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:`.
  Akibatnya resource eksternal (gambar http/https, `<link>` CSS, font, iframe) **diblokir**;
  CSS inline/`<style>` dan gambar `data:` tetap tampil.
- **FR-UD-42** Lebar preview penuh modal (bukan halaman A4); tombol Tutup dan `Esc`.
- **FR-UD-43** HTML hasil upload **tidak pernah** disisipkan langsung ke DOM CMS (`innerHTML`/
  `dangerouslySetInnerHTML`).

### 6.6 Unduh
- **FR-UD-50** Mengunduh isi tersimpan sebagai file `{document_id}.html`,
  `Content-Type: text/html; charset=utf-8`, `Content-Disposition: attachment`,
  `X-Content-Type-Options: nosniff`. Isi identik dengan `content_html` tersimpan.

### 6.7 Hapus
- **FR-UD-60** Soft delete header (`is_deleted = true`). Baris konten tidak lagi dapat diakses
  (GET/unduh → 404). ID tetap tidak bisa dipakai ulang.

## 7. API Contract

Prefix `/api`, Bearer JWT wajib. List mengikuti format repo `{ data, meta: { total, page, limit, totalPages } }`.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/upload-documents?search=&is_active=&page=&limit=` | list header (tanpa isi), berisi `size_bytes` |
| GET | `/upload-documents/:id` | header + `content_html` (untuk preview) |
| GET | `/upload-documents/:id/download` | file `.html` (attachment) |
| POST | `/upload-documents` | multipart: `file`, `document_id`, `document_name`, `document_desc?` → 201 |
| PUT | `/upload-documents/:id/file` | multipart: `file` → ganti isi, `revision + 1` |
| PATCH | `/upload-documents/:id` | `{document_name?, document_desc?, is_active?}` |
| DELETE | `/upload-documents/:id` | soft delete → `{ok: true}` |

- `UploadDocumentQueryDto extends PaginationDto` dengan `is_active?: boolean` (wajib dideklarasikan,
  lihat `agents.md` §4).
- Upload memakai multer **memory storage** (file tidak ditulis ke `/uploads` yang publik),
  `limits.fileSize = 2 MB` (konstanta modul, terpisah dari `MAX_FILE_MB`).
- `size_bytes` dihitung dari `content_html` (mis. `OCTET_LENGTH`) tanpa memuat isi di list.

**Kode error:** `400` validasi (ekstensi, kosong, bukan UTF-8, bukan HTML, field form) ·
`401` token · `404` tidak ada/terhapus/bukan dokumen upload · `409` ID dipakai ·
`413` file > 2 MB · `500` lainnya.

**Perubahan pada API Master Document** (`/api/documents`): semua endpoint menambahkan syarat
`read_only IS NULL`, sehingga dokumen upload → 404 dan tidak muncul di list.

## 8. Keamanan

- **Tidak ada sanitasi isi** (isi disimpan utuh sesuai keputusan), sehingga keamanan bergantung pada
  cara render: hanya di `<iframe sandbox>` tanpa izin + CSP (FR-UD-40/41), dan unduhan sebagai attachment
  dengan `nosniff` (FR-UD-50). Ketiganya wajib.
- File tidak disimpan di filesystem dan tidak diserve lewat `/uploads` (yang saat ini publik).
- Validasi ekstensi + UTF-8 + ukuran di server; nama file asli tidak dipakai sebagai path.
- Konsumen API lain yang mengambil `content_html` dokumen upload harus memperlakukannya sebagai
  HTML tak tepercaya (dicatat di dokumentasi API/`agents.md`).

## 9. Kebutuhan Non-Fungsional

| Area | Target |
|---|---|
| Ukuran | maks 2 MB per file, 1 baris konten per dokumen |
| Kinerja | upload/ganti 2 MB ≤ 2 s di jaringan lokal; list tidak memuat `content_html` |
| Integritas | ganti file transaksional (tidak ada keadaan 0 atau 2 baris konten) |
| Browser | Chrome & Edge terbaru (utama), Firefox terbaru (best effort) |

## 10. Catatan Teknis (rekomendasi implementasi)

- Backend: modul baru `src/modules/upload-documents/` (controller, service, dto) memakai entity
  `MasterDocument`/`MasterDocumentContent` dari modul documents; daftarkan di `app.module.ts`.
- Konstanta `READ_ONLY_DOCUMENT = 'document'` dipakai bersama kedua modul.
- `DocumentsService`: tambahkan `read_only IS NULL` di `list`, `findActive`, `lockActive`, dan sumber
  `duplicate`; cek keunikan ID tetap tanpa filter (lintas modul).
- Kolom baru via `synchronize` (dev); production butuh migration (known issue repo).
- Frontend: halaman `src/app/dashboard/masters/upload-documents/page.tsx` + komponen preview
  `src/components/upload-document/HtmlPreview.tsx`; menu di `MENUS` `dashboard/layout.tsx`.
- Upload dari frontend: `FormData` lewat instance `api` (`@/lib/api`), bukan `fetch` mentah.
- Unduh: `api.get(..., { responseType: 'blob' })` lalu `<a download>` (pola CSV yang sudah ada).

## 11. Kriteria Penerimaan

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AC-UD-01 | Upload `laporan.html` (UTF-8, 300 KB) dengan ID baru | 201; `master_document.read_only = 'document'`, status FINAL, `page_count = 0`; tepat 1 baris konten `page = 0` dengan isi identik |
| AC-UD-02 | Upload dengan ID yang sudah dipakai (dokumen upload, dokumen editor, atau terhapus) | 409 "ID sudah dipakai" |
| AC-UD-03 | Upload `.pdf` / file kosong / file non-UTF-8 | 400 dengan pesan yang jelas |
| AC-UD-04 | Upload file 3 MB | 413, tidak ada data tersimpan |
| AC-UD-05 | Ganti file | isi baris `page = 0` berubah, tetap 1 baris, `revision` naik, status tetap FINAL |
| AC-UD-06 | Preview file berisi `<style>` dan gambar `data:` | tampil sesuai CSS dan gambar |
| AC-UD-07 | Preview file berisi `<script>alert(1)</script>` dan `onload=` | tidak ada script yang jalan; peringatan ditampilkan saat upload |
| AC-UD-08 | Preview file berisi `<img src="https://…">` | tidak ada request ke luar (cek network), gambar tidak tampil |
| AC-UD-09 | Unduh | file `{id}.html` identik dengan isi tersimpan |
| AC-UD-10 | Dokumen upload di menu Master Document | tidak muncul di list; `GET /api/documents/:id` dan `PUT /content` → 404 |
| AC-UD-11 | Dokumen editor di menu Upload Document | tidak muncul; `GET /api/upload-documents/:id` → 404 |
| AC-UD-12 | Hapus | hilang dari list; GET/unduh → 404; ID tidak bisa dipakai ulang |
| AC-UD-13 | List: search, filter aktif, paging | hasil sesuai; filter `is_active` tidak dibuang validasi |

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| HTML tidak disanitasi | XSS bila dirender langsung di CMS atau aplikasi konsumen | render hanya di iframe sandbox + CSP, unduh sebagai attachment; peringatan untuk konsumen API |
| Resource eksternal diblokir | preview berbeda dari file asli (gambar/CSS eksternal hilang) | peringatan saat upload (FR-UD-13); anjurkan CSS inline dan gambar `data:` |
| File besar (gambar base64) | list/preview lambat | batas 2 MB; list tidak memuat isi |
| Tabel dipakai bersama dua modul | dokumen upload terubah lewat editor | filter `read_only` di semua query Document Generator + test (AC-UD-10/11) |

## 13. Rencana Rilis

| Fase | Isi |
|---|---|
| **1 — Backend** ✅ | kolom `read_only`, modul `upload-documents` (CRUD, upload/ganti multipart, unduh), filter `read_only IS NULL` di modul documents, unit test service + validasi file |
| **2 — Frontend** ✅ | menu & halaman Upload Document (list, upload, ganti file, edit, hapus), preview iframe sandbox + CSP, unduh, peringatan script/eksternal |

## 14. Keputusan (dikonfirmasi user, 2026-10-07)

1. Isi HTML disimpan **utuh** (tanpa sanitasi); preview di iframe sandbox tanpa izin script.
2. Kolom `read_only` varchar(20) NULL; `'document'` = dokumen upload, `NULL` = dokumen editor.
3. Operasi: upload baru (ID/nama/deskripsi), ganti file, preview + unduh, edit header, soft delete.
4. Dokumen upload hanya tampil di menu **Upload Document**, tidak di Master Document.
5. Batas file **2 MB**.
6. Status dokumen upload selalu **FINAL**.
7. Resource eksternal **diblokir** saat preview.
8. Nama file asli **tidak disimpan**; unduhan bernama `{document_id}.html`.
9. `page_count` dokumen upload diisi **`0`**.
