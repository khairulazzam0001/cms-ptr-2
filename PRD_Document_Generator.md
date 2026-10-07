# PRD — Document Generator (Master Document)

| | |
|---|---|
| Produk | CMS Data Master (cms-ptr-2) |
| Modul | Master Document — HTML Document Generator berbasis halaman A4 |
| Status | Disetujui — Fase 1–3 terimplementasi (2026-10-06) |
| Tanggal | 2026-10-06 |
| Stack | Backend NestJS 10 + TypeORM + MySQL · Frontend Next.js 14 + Tailwind + Axios · Editor **TipTap** (MIT) |

---

## 1. Latar Belakang & Tujuan

Admin membutuhkan cara membuat dokumen berformat (teks + tabel) langsung di CMS, dengan tampilan
yang mencerminkan kertas **A4**, sehingga tata letak per halaman sudah terlihat sejak menulis.
Hasilnya disimpan sebagai HTML per halaman dan dapat diambil lewat API.

**Tujuan MVP**
1. Admin bisa membuat, mengedit, menduplikat, dan menghapus dokumen dari menu **Master Document**.
2. Editor rich-text (setara CKEditor) dengan **batas halaman A4 otomatis** + page break manual.
3. Konten tersimpan **per halaman** (`master_document_content.page`) sesuai batas A4.
4. **Preview** read-only per halaman A4 sebelum/ sesudah difinalkan.
5. Tidak kehilangan pekerjaan: **autosave ke server** + status DRAFT/FINAL.

**Metrik keberhasilan**
- Isi preview identik dengan halaman di editor (jumlah halaman & isi tiap halaman sama).
- Tidak ada kehilangan konten saat autosave/refresh/network gagal sementara.
- Pagination ulang dokumen 20 halaman < 300 ms di laptop standar.

## 2. Ruang Lingkup

### 2.1 Termasuk (MVP)
- CRUD header dokumen + list (search, paging, filter status & aktif).
- Editor TipTap: format teks dasar + tabel + paste dari Word/Google Docs.
- Pagination A4 portrait, margin tetap, otomatis + manual page break.
- Penanganan overflow **opsi aman** (lihat §6.3).
- Penyimpanan per halaman, autosave server, status DRAFT/FINAL.
- Preview modal per halaman A4.
- Duplikat dokumen.
- Sanitasi HTML di backend.

### 2.2 Tidak termasuk (MVP)
- Gambar (tidak dikerjakan, keputusan 2026-10-07).
- ~~Header/footer berulang, nomor halaman~~ → dikerjakan di Fase 4 (§6.9).
- ~~Pemecahan paragraf per baris lintas halaman~~ → dikerjakan di Fase 4 (FR-29).
- Ukuran kertas lain, landscape, margin custom.
- Export file (.html/PDF), print (tidak dikerjakan, keputusan 2026-10-07), placeholder/template variabel.
- Versioning/riwayat versi (tidak dikerjakan, keputusan 2026-10-07), kolaborasi multi-user real-time.
- Sinkronisasi ke Google Sheets / CSV export.

## 3. Pengguna

Single admin (login JWT yang sudah ada). Semua endpoint di balik `JwtAuthGuard` global.

## 4. User Stories

| ID | Sebagai admin, saya ingin… | Supaya… |
|---|---|---|
| US-01 | membuat dokumen baru dengan `document_id` dan `document_name` | dokumen punya identitas unik |
| US-02 | menulis & memformat teks serta tabel di editor yang tampil per halaman A4 | tahu persis tata letak per halaman |
| US-03 | menyisipkan page break manual | memaksa konten mulai di halaman baru |
| US-04 | pekerjaan tersimpan otomatis | tidak kehilangan konten |
| US-05 | melihat preview per halaman | memeriksa hasil akhir sebelum final |
| US-06 | memfinalkan dokumen | menandai dokumen siap dipakai |
| US-07 | menempel konten dari Word/Google Docs | tidak mengetik ulang |
| US-08 | menduplikat dokumen | membuat dokumen baru dari dokumen yang ada |
| US-09 | mencari, memfilter, dan menghapus dokumen | daftar tetap rapi |

## 5. Data Model

Mengikuti konvensi repo (`agents.md` §4): soft delete via `is_deleted`, kolom audit, list paged.

### 5.1 `master_document` (header)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `document_id` | varchar(50) **PK** | diisi manual oleh admin, unik (termasuk yang soft-deleted) |
| `document_name` | varchar(150) NOT NULL | nama dokumen |
| `document_desc` | text NULL | deskripsi |
| `status` | varchar(10) NOT NULL default `'DRAFT'` | `DRAFT` \| `FINAL` |
| `is_active` | bool default true | dokumen aktif/nonaktif |
| `page_count` | int default 0 | jumlah halaman terakhir yang tersimpan (denormalisasi untuk list) |
| `revision` | int default 0 | naik setiap konten disimpan; dipakai untuk deteksi konflik (§7.4) |
| `header_left`, `header_center`, `header_right` | varchar(200) default `''` | header per slot (teks polos, §6.9) |
| `footer_left`, `footer_center` | varchar(200) default `''` | footer per slot |
| `footer_right` | varchar(200) default `'Halaman {page} dari {pages}'` | footer kanan (nomor halaman default) |
| `hide_header_footer_first_page` | bool default false | sembunyikan header/footer di halaman 1 |
| `created_by` | varchar NULL | username dari JWT |
| `created_date` | datetime (CreateDate) | |
| `modified_by` | varchar NULL | username dari JWT |
| `modified_date` | datetime (UpdateDate) | |
| `is_deleted` | bool default false | soft delete |

### 5.2 `master_document_content` (isi per halaman)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `document_content_id` | char(36) **PK** UUID | `@PrimaryGeneratedColumn('uuid')` |
| `document_id` | varchar(50) NOT NULL **FK** → `master_document.document_id` | |
| `page` | int NOT NULL | nomor halaman hasil pagination A4, mulai 1, berurutan tanpa celah |
| `content_html` | mediumtext NOT NULL | HTML ter-sanitasi untuk halaman tsb |
| `created_by`, `created_date`, `modified_by`, `modified_date`, `is_deleted` | | audit |

- **UNIQUE** (`document_id`, `page`) untuk baris `is_deleted = false`.
  Karena MySQL tidak mendukung partial unique index, baris lama **dihapus fisik** saat
  konten diganti (lihat §7.3). Ini satu-satunya pengecualian aturan soft delete, khusus
  tabel konten. Header tetap soft delete.
- **INDEX** (`document_id`, `page`): dipenuhi oleh index UNIQUE di atas (tidak dibuat index terpisah).

### 5.3 Representasi HTML khusus

| Elemen | HTML tersimpan | Fungsi |
|---|---|---|
| Page break manual | `<div data-page-break="true"></div>` di akhir halaman | saat dokumen dibuka ulang, break manual tetap ada |
| Tabel lanjutan | `<table data-continued="true">` | tabel ini lanjutan dari halaman sebelumnya |
| Header tabel ulang | `<thead data-repeated="true">` | header yang diulang di halaman lanjutan |
| List lanjutan | `<ul data-continued="true">` / `<ol data-continued="true" start="n">` | list ini lanjutan dari halaman sebelumnya; `start` meneruskan penomoran (FR-24) |
| Tabel tanpa border | `<table data-borderless="true">` | toggle border off (FR-35) |
| Paragraf lanjutan | `<p data-continued="true">` | potongan paragraf yang dipecah per baris (FR-29) |
| Paragraf berlanjut | `<p data-split="true">` | potongan yang masih berlanjut ke halaman berikutnya; bila justify, baris terakhirnya tetap rata kiri-kanan |

Saat dokumen dimuat ke editor, tabel/list/paragraf `data-continued` **digabung kembali** ke elemen
sebelumnya dan `thead[data-repeated]` dibuang, sehingga di editor tabel/list tetap satu kesatuan.
Di editor, header yang diulang tidak tampil; ruangnya tetap disisakan agar batas halaman
editor sama dengan data tersimpan/preview.

## 6. Kebutuhan Fungsional

### 6.1 List Dokumen — `/dashboard/masters/documents`
- **FR-01** Tabel kolom: ID, Nama, Status (badge DRAFT/FINAL), Aktif, Jumlah Halaman, Terakhir diubah, Aksi.
- **FR-02** Search (debounce 400 ms) pada `document_id`, `document_name`, `document_desc`.
- **FR-03** Filter status (Semua/DRAFT/FINAL) dan aktif (Semua/Aktif/Nonaktif).
- **FR-04** Paging (Prev/Next, "Halaman x / y — Total n"), default 10/halaman.
- **FR-05** Aksi per baris: **Edit**, **Preview**, **Duplikat**, **Hapus** (konfirmasi).
- **FR-06** Tombol **+ Dokumen Baru**. State kosong menampilkan ajakan membuat dokumen.

### 6.2 Membuat & Mengedit Dokumen
- **FR-10** Dokumen Baru: modal isi `document_id` (wajib, ≤ 50 char, huruf/angka/`-`/`_`),
  `document_name` (wajib, ≤ 150), `document_desc` (opsional). Setelah tersimpan → buka editor.
  `document_id` bentrok (termasuk yang sudah dihapus) → pesan "ID sudah dipakai".
- **FR-11** Halaman editor `/dashboard/masters/documents/[id]/edit`:
  - Bar atas: nama dokumen (bisa diedit), badge status, indikator simpan, tombol
    **Preview**, **Simpan Final**, **Kembali**.
  - Toolbar editor (§6.4).
  - Area kerja: kanvas abu-abu berisi lembar-lembar A4 putih bertumpuk vertikal dengan jarak antar halaman.
- **FR-12** `document_id` tidak dapat diubah setelah dibuat.
- **FR-13** Mengubah `document_name`/`document_desc`/`is_active` **tidak** mengubah status.
  Hanya perubahan **konten** yang mengembalikan FINAL → DRAFT.

### 6.3 Pagination A4
- **FR-20** Ukuran: A4 portrait **210 × 297 mm**; margin tetap **25,4 mm** semua sisi →
  area konten **159,2 × 246,2 mm** (≈ 602 × 931 px @96 dpi).
- **FR-21** Font konsisten di editor, pagination, dan preview (font default ditetapkan saat
  implementasi; wajib tersedia di semua browser target, contoh: Arial) agar hasil hitung sama.
- **FR-22** **Otomatis**: blok level atas (paragraf, heading, list item, tabel) ditata berurutan;
  bila blok tidak muat di sisa halaman, blok **dipindah utuh** ke halaman berikutnya.
- **FR-23** **Tabel**: dipecah **per baris (row)**. Baris yang tidak muat pindah ke halaman
  berikutnya; jika tabel punya baris header (`<th>` di baris pertama), header **diulang**
  di setiap halaman lanjutan. Satu baris tidak pernah dipecah.
- **FR-24** **List**: dipecah per item (`<li>`), penomoran berlanjut di halaman berikutnya.
- **FR-25** **Page break manual**: tombol toolbar + shortcut `Ctrl+Enter`. Konten setelah break
  selalu mulai di halaman baru. Break tampil sebagai garis putus-putus berlabel "Page break" di editor
  dan tidak terlihat di preview.
- **FR-26** **Blok tak terpecah yang lebih tinggi dari satu halaman** (heading, satu baris
  tabel / item list sangat tinggi; paragraf kini dipecah per baris, FR-29): ditempatkan di halaman sendiri, dibiarkan melewati batas, dan diberi
  **tanda peringatan** di editor ("Konten melebihi 1 halaman — pecah paragraf ini"). Saat
  disimpan, blok tetap di satu `page`.
- **FR-27** Pagination dihitung ulang setiap perubahan konten (debounce ≤ 150 ms) dan saat dokumen dibuka.
- **FR-28** Pembagian halaman yang sama dipakai untuk: tampilan editor, payload simpan, dan preview.
- **FR-29** **Paragraf dipecah per baris** (Fase 4): paragraf level atas yang tidak muat di sisa
  halaman dipecah di batas baris; potongan berikutnya `<p data-continued>`. Kontrol widow/orphan:
  minimal **2 baris** di bawah halaman dan 2 baris di halaman berikutnya (paragraf ≤ 3 baris dipindah
  utuh). Paragraf lebih dari satu halaman dipecah ke beberapa halaman. Heading, item list, dan baris
  tabel tetap dipindah utuh.

### 6.9 Header & Footer (Fase 4)
- **FR-80** Header dan footer per dokumen, masing-masing 3 slot teks polos (kiri / tengah / kanan),
  maks 200 karakter per slot, diatur lewat tombol **Header & Footer** di editor.
- **FR-81** Token `{page}` (nomor halaman) dan `{pages}` (jumlah halaman). Default dokumen baru:
  footer kanan `Halaman {page} dari {pages}`.
- **FR-82** Header di margin atas & footer di margin bawah, 12,7 mm dari tepi kertas, Arial 9 pt abu-abu;
  tidak mengurangi area konten (pagination tidak berubah).
- **FR-83** Opsi **Sembunyikan header/footer di halaman pertama**; penomoran tetap mulai dari 1.
- **FR-84** Tampil di editor (per lembar) dan preview. Disimpan bersama konten (`PUT /content`
  field `header_footer`, revision yang sama) sehingga mengubahnya mengembalikan FINAL → DRAFT.
  Ikut disalin saat duplikat. Dirender sebagai teks (bukan HTML).

### 6.4 Toolbar Editor (TipTap)
- **FR-30** Teks: Paragraf, Heading 1–3, **Bold**, *Italic*, Underline, Strikethrough.
- **FR-31** Ukuran font (pt): 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36. Default 11 pt.
- **FR-32** Warna teks (palet ±12 warna + reset).
- **FR-33** Alignment: kiri, tengah, kanan, justify.
- **FR-34** Bullet list, numbered list, indent/outdent (`Tab` / `Shift+Tab`). Indent paragraf/heading
  = `padding-left` 24 px per level, maks 8 level; di dalam list = item turun/naik satu level (sub-list).
- **FR-35** Tabel: sisip (pilih baris × kolom, maks 20 × 10), tambah/hapus baris & kolom,
  hapus tabel, merge/split cell, toggle baris header, border on/off.
- **FR-36** Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), page break (§6.3).
- **FR-37** Format di luar daftar ini tidak tersedia dan dibuang saat paste/simpan.

### 6.5 Paste dari Word / Google Docs
- **FR-40** Paste mempertahankan: heading, bold/italic/underline/strike, list, alignment,
  warna & ukuran font (dibulatkan ke ukuran terdekat FR-31), tabel (termasuk merge cell).
- **FR-41** Dibuang: class/atribut `mso-*`, font family, background, gambar, komentar, field
  Word, style lain di luar allowlist §8.
- **FR-43** List dari Word (paragraf `MsoListParagraph`) dikonversi menjadi `<ol>`/`<ul>` **satu level**;
  tingkat sub-list Word belum dikenali (MVP). List dari Google Docs tetap bertingkat.
- **FR-42** Paste plain text (`Ctrl+Shift+V`) menghapus seluruh format.

### 6.6 Simpan, Autosave & Status
- **FR-50** **Autosave** ke server **10 detik** setelah perubahan terakhir, juga saat
  meninggalkan halaman editor (route change) dan saat tombol Preview/Simpan Final ditekan.
- **FR-51** Indikator simpan: "Tersimpan", "Ada perubahan", "Menyimpan…", "Gagal menyimpan — Coba lagi".
- **FR-52** Gagal simpan (network/5xx): konten tetap di editor, retry otomatis (10 s, 30 s, 60 s),
  tombol "Coba lagi" manual. Tidak ada request simpan paralel (satu in-flight, sisanya di-queue
  sebagai satu request terbaru).
- **FR-53** Ada perubahan belum tersimpan + user menutup tab/refresh → peringatan browser (`beforeunload`).
- **FR-54** Simpan konten pada dokumen **FINAL** → status otomatis menjadi **DRAFT**
  (indikator memberi tahu: "Dokumen kembali ke DRAFT").
- **FR-55** **Simpan Final**: flush autosave, lalu set status FINAL. Ditolak bila dokumen kosong
  (tidak ada teks/tabel) → pesan "Dokumen masih kosong".

### 6.7 Preview
- **FR-60** Tombol Preview (editor & list) membuka **modal layar penuh** read-only.
- **FR-61** Menampilkan halaman dari data tersimpan (`master_document_content` urut `page`),
  setiap halaman sebagai lembar A4 dengan margin yang sama, label "Halaman x dari n".
- **FR-62** Dari editor, preview dibuka **setelah** autosave selesai sehingga isi = versi terbaru.
- **FR-63** Navigasi: scroll, tombol halaman sebelumnya/berikutnya, `Esc` untuk tutup.

### 6.8 Duplikat & Hapus
- **FR-70** Duplikat: modal isi `document_id` baru (wajib) + `document_name` (default
  "Salinan dari {nama}"). Server menyalin header + semua halaman; status hasil **DRAFT**.
- **FR-71** Hapus: soft delete header (`is_deleted = true`); konten tidak lagi dapat diakses.
  Dokumen terhapus tidak tampil di list dan GET mengembalikan 404.

## 7. API Contract

Prefix `/api`, Bearer JWT wajib. Response list mengikuti format repo:
`{ data, meta: { total, page, limit, totalPages } }`.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/documents?search=&status=&is_active=&page=&limit=` | list header (tanpa konten), berisi `page_count` |
| GET | `/documents/:id` | header + `pages: [{page, content_html}]` urut `page` |
| POST | `/documents` | buat header `{document_id, document_name, document_desc?}` → 201, status DRAFT, 0 halaman |
| PATCH | `/documents/:id` | ubah `{document_name?, document_desc?, is_active?}` (status tidak berubah) |
| PUT | `/documents/:id/content` | ganti seluruh konten `{revision, pages:[{page, content_html}], header_footer?}` |
| POST | `/documents/:id/finalize` | `{revision}` → status FINAL |
| POST | `/documents/:id/duplicate` | `{document_id, document_name?}` → 201 dokumen baru |
| DELETE | `/documents/:id` | soft delete → `{ok:true}` |

### 7.1 Query DTO
`DocumentQueryDto extends PaginationDto` dengan `status?: 'DRAFT'|'FINAL'` dan `is_active?: boolean`
(wajib dideklarasikan agar tidak dibuang `whitelist`, lihat `agents.md` §4).

### 7.2 Validasi `PUT /content`
- `pages` 1..**200** item; `page` harus berurutan 1..n tanpa duplikat/celah.
- `content_html` string, ≤ **512 KB** per halaman; total body ≤ **5 MB**
  (batas body parser Nest **harus dinaikkan** dari default 100 KB).
- HTML disanitasi (§8) sebelum disimpan; respons mengembalikan konten hasil sanitasi.

### 7.3 Perilaku simpan
Dalam **satu transaksi**:
1. Kunci baris header (`SELECT … FOR UPDATE`), cek `revision`.
2. Hapus semua baris `master_document_content` milik dokumen.
3. Insert halaman baru (UUID baru).
4. Update header: `page_count = n`, `revision = revision + 1`, `modified_by/date`,
   dan `status = 'DRAFT'` jika sebelumnya FINAL.
5. Respons: `{ revision, status, page_count, modified_date }`.

### 7.4 Konflik
`revision` di request ≠ `revision` di DB → **409** `"Dokumen telah diubah di tab/sesi lain"`.
UI menampilkan pilihan **Muat ulang** (ambil versi server) atau **Timpa** (kirim ulang dengan revision terbaru).

### 7.5 Kode error
`400` validasi · `401` token · `404` dokumen tidak ada/terhapus · `409` ID dipakai / konflik revision ·
`413` payload terlalu besar · `500` lainnya. Error **tidak** boleh 500 untuk id tidak ditemukan.

## 8. Keamanan

- **Sanitasi HTML di backend** (library `sanitize-html`) dengan allowlist:
  - Tag: `p, h1, h2, h3, strong, b, em, i, u, s, br, span, ol, ul, li, table, thead, tbody, tr, th, td, div`.
  - Atribut: `style` (semua tag teks/tabel), `colspan`, `rowspan` (`th, td`),
    `data-page-break` (`div`), `data-continued` (`table, ul, ol`), `data-repeated` (`thead`),
    `data-borderless` (`table`), `start` (`ol`), `data-continued` & `data-split` (`p`).
  - Nilai atribut divalidasi: penanda `data-*` hanya `"true"` (selain itu atribut dibuang);
    `start`, `colspan`, `rowspan` hanya angka.
  - Style properti: `color`, `font-size`, `text-align`, `padding-left` (indent), `width`,
    `border`, `border-collapse`, `vertical-align`. Nilai divalidasi pola (tanpa `url(`, `expression`).
  - Dibuang: `script`, `style`, `iframe`, event handler (`on*`), `href`/`src`, komentar.
- Preview merender HTML hasil sanitasi; frontend tetap tidak mengeksekusi script.
- `created_by`/`modified_by` diisi dari `req.user.username`, bukan hardcoded.

## 9. Kebutuhan Non-Fungsional

| Area | Target |
|---|---|
| Kinerja | pagination ulang ≤ 300 ms untuk 20 halaman; buka dokumen 50 halaman ≤ 2 s |
| Batas | maks 200 halaman / dokumen, 512 KB / halaman |
| Browser | Chrome & Edge versi terbaru (target utama), Firefox terbaru (best effort) |
| Konsistensi | jumlah & isi halaman editor = preview di browser yang sama |
| Ketahanan | tidak ada kehilangan konten saat autosave gagal; retry otomatis |
| Aksesibilitas | toolbar dapat diakses keyboard, tombol punya `aria-label` |

## 10. Catatan Teknis (rekomendasi implementasi)

- **Frontend dependensi baru**: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`,
  ekstensi underline, text-align, text-style + color + font-size, table (row/cell/header).
  Versi dikunci saat implementasi. **Backend**: `sanitize-html`.
- **Satu instance editor** untuk seluruh dokumen (bukan satu editor per halaman) agar
  undo/redo, seleksi, dan paste lintas halaman berjalan normal.
- **Paginator** (modul terpisah, murni fungsi): ukur tinggi blok di DOM editor →
  hasilkan daftar break. Dipakai untuk:
  1. Visual editor: dekorasi spacer + bayangan batas halaman di posisi break (ProseMirror decorations),
     tanpa mengubah dokumen.
  2. Payload simpan: memotong HTML menjadi `pages[]`, termasuk pemecahan tabel + header ulang (§5.3).
- Header tabel yang diulang **ditampilkan di preview dan data tersimpan**; di editor cukup
  ditandai batas halaman di antara baris (tabel tetap satu node).
- Saat memuat: gabung `pages[]` → satu HTML (merge tabel `data-continued`, buang `thead[data-repeated]`)
  → `editor.commands.setContent()` → paginator berjalan ulang.
- Backend modul baru `src/modules/documents/` (entity, dto, service, controller, module),
  didaftarkan di `app.module.ts`; menu baru di `MENUS` `dashboard/layout.tsx`.

## 11. Kriteria Penerimaan (ringkas)

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AC-01 | Buat dokumen ID baru | 201, masuk editor, status DRAFT, 1 halaman kosong |
| AC-02 | Buat dengan ID yang sudah ada / terhapus | 409, pesan "ID sudah dipakai" |
| AC-03 | Ketik melebihi 1 halaman | halaman 2 muncul otomatis; paragraf yang tidak muat pindah utuh |
| AC-04 | Tabel 60 baris dengan header | dipecah per baris ke beberapa halaman; preview menampilkan header di tiap halaman |
| AC-05 | Sisip page break di tengah halaman 1 | konten setelahnya mulai di halaman 2; `page` tersimpan sesuai |
| AC-06 | Berhenti mengetik 10 detik | request `PUT /content` terkirim, indikator "Tersimpan", `revision` naik |
| AC-07 | Server mati saat autosave | indikator gagal, konten tetap, retry otomatis, berhasil saat server hidup |
| AC-08 | Buka ulang dokumen | konten sama, tabel lanjutan tergabung lagi, jumlah halaman sama |
| AC-09 | Edit dokumen FINAL lalu autosave | status jadi DRAFT |
| AC-10 | Simpan Final dokumen kosong | ditolak, pesan "Dokumen masih kosong" |
| AC-11 | Paste dari Word (heading, list, tabel merge) | format tetap; class `mso-*` & font family hilang |
| AC-12 | Payload berisi `<script>`/`onclick`/`javascript:` | dibuang oleh sanitasi; tidak tereksekusi di preview |
| AC-13 | Simpan dari 2 tab dengan revision lama | tab kedua mendapat 409 + pilihan Muat ulang/Timpa |
| AC-14 | Duplikat dokumen | dokumen baru DRAFT, isi & jumlah halaman sama, ID berbeda |
| AC-15 | Hapus dokumen | hilang dari list, GET → 404 |
| AC-16 | Preview | jumlah halaman & isi tiap halaman sama dengan editor |
| AC-17 | List: search, filter status, paging | hasil sesuai; filter `status` tidak dibuang validasi |

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Pagination custom (tidak ada solusi siap pakai gratis) | estimasi molor, bug tata letak | paginator sebagai modul terisolasi + unit test; opsi aman (blok pindah utuh) di MVP |
| Perbedaan render font antar browser | posisi break berbeda | font tetap, target Chrome/Edge, pagination dihitung ulang saat dibuka |
| Pemecahan & penggabungan tabel lintas halaman | tabel rusak saat load ulang | marker `data-continued`/`data-repeated` + test round-trip simpan→muat |
| Paste Word menghasilkan HTML kotor | format aneh, payload besar | pembersihan di klien (transformPastedHTML) + sanitasi server |
| Payload besar | 413 / lambat | batas 200 halaman & 512 KB/halaman, body limit 5 MB |

## 13. Rencana Rilis

| Fase | Isi |
|---|---|
| **1 — Backend** ✅ | entity + migrasi via synchronize (dev), CRUD header, `PUT /content` transaksional, finalize, duplicate, sanitasi, unit test service |
| **2 — Editor** ✅ | halaman list, editor TipTap + toolbar, paginator (blok utuh + tabel per baris), page break manual, paste cleanup |
| **3 — Simpan & Preview** ✅ | autosave + retry + konflik revision, status DRAFT/FINAL, preview modal, duplikat/hapus di UI |
| **4 — Paragraf & Header/Footer** ✅ | pemecahan paragraf per baris + widow/orphan 2 baris (FR-29), header/footer 3 slot + nomor halaman (§6.9) |
| ~~Fase berikutnya~~ | gambar, export PDF/print, versioning: **tidak dikerjakan** (keputusan 2026-10-07) |

## 14. Keputusan (disetujui 2026-10-06)

1. Penambahan kolom **`page_count`** dan **`revision`** di `master_document` (di luar daftar awal) —
   untuk list cepat dan deteksi konflik.
2. Baris `master_document_content` **dihapus fisik** saat konten diganti (pengecualian aturan
   soft delete, karena UNIQUE `document_id+page`). Alternatif: soft delete + tanpa UNIQUE di DB.
3. Margin tetap **25,4 mm** dan font default (mis. Arial 11 pt).
4. Perubahan nama/deskripsi **tidak** mengembalikan FINAL → DRAFT (hanya perubahan konten).
5. Batas 200 halaman / dokumen dan 512 KB / halaman.

Penyesuaian saat implementasi (disetujui 2026-10-06):

6. Allowlist §8 ditambah `start` (`ol`), `data-continued` (`ul, ol`), `data-borderless` (`table`)
   untuk penomoran list lanjutan (FR-24) dan toggle border (FR-35).
7. Indent 24 px per level, maks 8 (FR-34).
8. List Word di-paste sebagai satu level (FR-43).
9. Index (`document_id`, `page`) memakai index UNIQUE yang sama.
10. Versi dependensi dikunci: TipTap 3.31.4, `sanitize-html` 2.17.0 (2.18 ESM-only, gagal di Jest).
11. Fase 4: header/footer 3 slot teks polos; default footer kanan `Halaman {page} dari {pages}`;
    opsi sembunyikan di halaman 1; widow/orphan minimal 2 baris.
12. Gambar, export PDF/print, dan versioning **tidak dikerjakan** (2026-10-07).
