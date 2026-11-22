# PRD — Import BARS & Behaviour (Excel)

| | |
|---|---|
| Produk | CMS Data Master (cms-ptr-2) |
| Modul | Import/Export `master_key_action_bars` + `master_key_action_bars_behaviour` via file Excel (.xlsx) |
| Status | Disetujui — Fase 1–2 terimplementasi (2026-11-22); format matriks §5.2a (2026-11-23) |
| Tanggal | 2026-11-22 |
| Terkait | Halaman Key Action Matrix (`/dashboard/masters/key-action-matrix`), modul `assessment-data` |
| Stack | Backend NestJS 10 + TypeORM + MySQL · Frontend Next.js 14 + Tailwind + Axios · Library baru: **`exceljs`** (MIT, backend) |

---

## 1. Latar Belakang & Tujuan

BARS (Behaviourally Anchored Rating Scale) dan behaviour per key action disusun tim assessment di
Excel, lalu selama ini dimasukkan ke DB secara manual (SQL / impor satu kali). Belum ada cara dari
CMS untuk mengisi atau memperbarui data ini, dan halaman Key Action Matrix hanya menampilkannya.

**Tujuan**
1. Admin dapat meng-upload file Excel berisi BARS + behaviour **untuk satu simulation** dari CMS.
2. Isi file menjadi data final simulation tersebut (mode **ganti per simulation**).
3. Admin melihat **preview** (ringkasan + error per baris) sebelum menyimpan; penyimpanan
   **semua atau tidak sama sekali**.
4. Admin dapat mengunduh **template** kosong dan **export** data yang ada dalam format yang sama,
   sehingga alur "export → edit di Excel → upload ulang" berjalan tanpa kehilangan data.

**Metrik keberhasilan**
- Export lalu import ulang file yang sama tanpa diubah → data tidak berubah (tanpa duplikat, tanpa baris hilang).
- Tidak ada data setengah tersimpan saat file berisi error.
- Key Action Matrix langsung menampilkan hasil import.

## 2. Ruang Lingkup

### 2.1 Termasuk
- Menu baru **Import BARS** di sidebar (halaman upload, preview, simpan, unduh template, export).
- Tombol pintas **Import / Export BARS** di halaman Key Action Matrix yang membuka menu tersebut
  dengan simulation yang sedang dipilih.
- Validasi isi file per baris dengan pesan error yang menyebut nomor baris & kolom Excel.
- Penyimpanan transaksional ke `master_key_action_bars` dan `master_key_action_bars_behaviour`.

### 2.2 Tidak termasuk
- Membuat/mengubah **key action** (`master_key_action`) atau kompetensi lewat import; key action wajib sudah ada.
- Import banyak simulation dalam satu file.
- Edit BARS/behaviour per baris di UI (CRUD manual); Key Action Matrix tetap read-only.
- Format selain `.xlsx` (CSV, `.xls` lama, Google Sheets langsung).
- Riwayat versi / undo import (data lama hanya di-soft delete).

## 3. Pengguna

Single admin (login JWT yang sudah ada). Semua endpoint di balik `JwtAuthGuard` global.

## 4. User Stories

| ID | Sebagai admin, saya ingin… | Supaya… |
|---|---|---|
| IB-01 | mengunduh template Excel | tahu kolom dan format yang benar |
| IB-02 | mengekspor BARS + behaviour satu simulation | bisa mengedit data yang ada di Excel |
| IB-03 | meng-upload file Excel untuk satu simulation | BARS & behaviour simulation itu terisi tanpa SQL |
| IB-04 | melihat preview dan daftar error sebelum menyimpan | tidak ada data salah atau setengah tersimpan |
| IB-05 | membuka import langsung dari Key Action Matrix | alur lihat → perbaiki → lihat lagi cepat |

## 5. Format File Excel

### 5.1 Struktur workbook

| Sheet | Isi | Dibaca saat import |
|---|---|---|
| `BARS` | data, 1 baris = 1 behaviour (header di baris 1, data mulai baris 2) | ya |
| `Info` | `simulation_id`, `simulation_name`, tanggal export (diisi sistem) | ya, hanya untuk pengecekan simulation (FR-IB-24) |
| `Referensi` | daftar key action valid: `key_action_id`, nama, kompetensi | tidak |
| `Petunjuk` | penjelasan kolom & contoh | tidak |

### 5.2 Kolom sheet `BARS`

| Kolom | Wajib | Aturan |
|---|---|---|
| `key_action_id` | ya | harus ada di `master_key_action` (aktif). Dicocokkan **hanya** dengan `key_action_id` |
| `bars_type` | ya | `POSITIVE` / `NETRAL` / `NEGATIVE` (huruf besar/kecil bebas, disimpan huruf besar). Template memberi dropdown |
| `bars_no` | ya | bilangan bulat ≥ 1; urutan BARS dalam key action + tipe yang sama |
| `bars_name` | ya | teks BARS |
| `behaviour_no` | ya bila `behaviour` diisi | bilangan bulat ≥ 1; urutan behaviour dalam BARS |
| `behaviour` | tidak | teks behaviour. Kosong = baris BARS tanpa behaviour |
| `weight` | tidak | bilangan bulat **≥ 1**; **kosong = 1** |
| `need_ai` | tidak | `TRUE/FALSE`, `1/0`, `YA/TIDAK` (huruf bebas); **kosong = TRUE** |

Aturan pengelompokan:
- Satu **BARS** = kombinasi (`key_action_id`, `bars_type`, `bars_no`). Behaviour yang sama-sama
  milik BARS itu ditulis di baris berbeda dengan kolom BARS diulang.
- Baris-baris milik BARS yang sama harus punya `bars_name` dan `need_ai` yang sama; bila berbeda → error.
- (`BARS`, `behaviour_no`) harus unik; duplikat → error.
- Satu BARS boleh punya satu baris tanpa behaviour **atau** satu/lebih baris berbehaviour, bukan campuran
  keduanya (campuran → error, agar maksud data jelas).

Contoh:

| key_action_id | bars_type | bars_no | bars_name | behaviour_no | behaviour | weight | need_ai |
|---|---|---|---|---|---|---|---|
| CI1 | POSITIVE | 1 | Menemukan permasalahan secara utuh dari data | 1 | Membaca seluruh data yang tersedia | | TRUE |
| CI1 | POSITIVE | 1 | Menemukan permasalahan secara utuh dari data | 2 | Menyimpulkan akar masalah | 2 | TRUE |
| CI1 | NEGATIVE | 1 | Keliru dalam mengidentifikasi masalah | | | | |

### 5.2a Format matriks (default template & export, 2026-11-23)

Sheet `BARS` dalam format matriks meniru tampilan Key Action Matrix. Format lama (5.2, "flat") tetap didukung.
Saat import, sistem **mengenali format dari header** baris 1: ada `bars_type` → flat; ada `POSITIVE` → matriks.
Template & export memakai format matriks kecuali dipilih "Flat" di halaman Import BARS (`?format=flat`).

| Kolom | Aturan |
|---|---|
| `key_action_id` | membuka blok key action (harus ada di master). Kosong = baris lanjutan blok di atasnya. 1 key action = 1 blok; muncul lagi (huruf besar/kecil diabaikan) → error |
| `POSITIVE` / `NETRAL` / `NEGATIVE` | nama BARS; tiap sel terisi = BARS baru. `bars_no` = urutan baris dalam key action + tipe |
| `POSITIVE behaviour` / `NETRAL behaviour` / `NEGATIVE behaviour` | behaviour milik BARS terakhir tipe yang sama, **boleh sebaris** dengan nama BARS atau di bawahnya. `behaviour_no` = urutan baris |

- `weight` selalu **1** dan `need_ai` selalu **TRUE** (keputusan user; data yang ada saat keputusan diambil
  memang semuanya 1/TRUE). Butuh nilai lain → pakai format flat.
- Error: baris pertama tanpa `key_action_id`; behaviour tanpa BARS di atasnya; key action tidak ada / ganda
  (seluruh blok dilewati); ID > 50 karakter. Header matriks wajib lengkap 7 kolom.
- Urutan baris = data: sort/filter di Excel merusak struktur; menyisipkan BARS di tengah menggeser nomor
  (dan ID) BARS di bawahnya.

| key_action_id | POSITIVE | POSITIVE behaviour | NETRAL | NETRAL behaviour | NEGATIVE | NEGATIVE behaviour |
|---|---|---|---|---|---|---|
| BA1 | Ini Bars Satu Positive | | Ini Bars Satu NETRAL | | Ini Bars Satu NEGATIVE | |
| | | Ini Bars Satu Positive - Bars Behaviour 1 | | Ini Bars Satu NETRAL - Bars Behaviour 1 | | Ini Bars Satu NEGATIVE - Bars Behaviour 1 |
| | | Ini Bars Satu Positive - Bars Behaviour 2 | | | | |
| | Ini Bars Dua Positive | | | | | |
| | | Ini Bars Dua Positive - Bars Behaviour 1 | | | | |

→ BA1 POSITIVE no 1 (2 behaviour), POSITIVE no 2 (1), NETRAL no 1 (1), NEGATIVE no 1 (1).

### 5.3 Pembersihan nilai
- Spasi di awal/akhir dipangkas; karakter tak terlihat (zero-width space U+200B, U+FEFF, dll.)
  dibuang dari semua teks. (Data kompetensi yang ada saat ini memuat karakter semacam ini.)
- Sel berisi formula dibaca **nilai hasilnya**.
- Baris yang semua kolomnya kosong diabaikan.
- Kolom di luar daftar 5.2 diabaikan (dilaporkan sebagai peringatan); kolom wajib yang hilang dari
  header → file ditolak.

## 6. Pemetaan ke Database

Simulation **dipilih di layar**, tidak ditulis per baris.

### 6.1 `master_key_action_bars`

| Kolom | Nilai |
|---|---|
| `bars_id` | `{key_action_id}-{bars_type}-{simulation_id}-{bars_no}` (mengikuti pola data yang ada, mis. `CI1-NEGATIVE-bottleneck-1`) |
| `key_action_id`, `bars_type`, `bars_name`, `need_ai` | dari file |
| `sort_order` | `bars_no` |
| `simulation_id` | simulation yang dipilih |
| `is_deleted` | `false` (baris lama yang pernah dihapus dihidupkan lagi bila ID sama) |
| audit | `created_by`/`modified_by` dari JWT |

### 6.2 `master_key_action_bars_behaviour`

| Kolom | Nilai |
|---|---|
| `bars_behaviour_id` | `{bars_id}-{behaviour_no}` |
| `bars_id`, `key_action_id` | dari BARS induk |
| `bars_behaviour` | kolom `behaviour` |
| `weight` | dari file, kosong = 1 |
| `sort_order` | `behaviour_no` |
| `is_deleted` | `false` |

- ID dibuat sistem sehingga upload ulang file yang sama **tidak menggandakan** data.
- `bars_id` dan `bars_behaviour_id` maksimal 50 karakter (varchar(50)); bila melebihi → **error baris**,
  ID tidak dipendekkan otomatis.

## 7. Kebutuhan Fungsional

### 7.1 Menu Import BARS — `/dashboard/masters/key-action-bars-import`
- **FR-IB-01** Menu sidebar **Import BARS**, di bawah **Key Action Matrix**.
- **FR-IB-02** Dropdown simulation (`/simulations/options/all`). Bila dibuka dari Key Action Matrix,
  simulation terisi otomatis dari query `?simulation_id=`.
- **FR-IB-03** Ringkasan data saat ini untuk simulation terpilih: jumlah BARS per tipe dan jumlah behaviour.
- **FR-IB-04** Tombol **Unduh template** dan **Export data** (format §5).
- **FR-IB-05** Area pilih file `.xlsx` + tombol **Preview**.

### 7.2 Template & Export
- **FR-IB-10** Template: sheet `BARS` berisi header saja (contoh baris ditaruh di sheet `Petunjuk` agar
  tidak ikut ter-import bila lupa dihapus), dropdown validasi untuk `bars_type` dan `need_ai`; sheet `Referensi` berisi daftar
  key action aktif; sheet `Petunjuk`; sheet `Info` berisi simulation terpilih (bila ada).
- **FR-IB-11** Export: sama dengan template tetapi sheet `BARS` berisi data aktif simulation, urut
  kompetensi → key action → tipe (POSITIVE, NETRAL, NEGATIVE) → `bars_no` → `behaviour_no`.
- **FR-IB-12** Nama file: `BARS_{simulation_id}_{yyyymmdd}.xlsx` (template: `BARS_template.xlsx`).
- **FR-IB-13** Export lalu import ulang tanpa perubahan menghasilkan data identik (round-trip).

### 7.3 Preview
- **FR-IB-20** Preview mem-parse dan memvalidasi file di server **tanpa menyimpan**.
- **FR-IB-21** Hasil preview:
  - ringkasan: jumlah baris dibaca; BARS & behaviour **baru / diubah / tidak berubah / akan dihapus** per tipe;
  - daftar **error** (nomor baris Excel, kolom, pesan), dikelompokkan dan dapat digulir;
  - daftar **peringatan** (mis. kolom tak dikenal). Peringatan "key action aktif yang tidak punya BARS
    di file" **tidak** dibuat untuk saat ini (keputusan §16 no. 12).
- **FR-IB-22** Tombol **Simpan** hanya aktif bila tidak ada error.
- **FR-IB-23** Mengganti file atau simulation mengosongkan hasil preview (harus preview ulang).
- **FR-IB-24** Bila sheet `Info` berisi `simulation_id` yang berbeda dari simulation terpilih → error
  "File ini milik simulation X" (mencegah salah upload hasil export simulation lain).

### 7.4 Simpan (mode ganti per simulation)
- **FR-IB-30** Simpan mengirim file yang sama; server **memvalidasi ulang** (tidak mempercayai hasil preview).
- **FR-IB-31** Dalam **satu transaksi**:
  1. Upsert semua BARS dari file (ID §6.1), `is_deleted = false`.
  2. Upsert semua behaviour dari file (ID §6.2), `is_deleted = false`.
  3. **Soft delete** BARS simulation tersebut yang tidak ada di file, beserta behaviournya.
  4. **Soft delete** behaviour milik BARS yang tetap ada tetapi tidak ada di file.
- **FR-IB-32** Gagal di langkah mana pun → rollback, tidak ada perubahan.
- **FR-IB-33** Berhasil → tampilkan ringkasan (sama format dengan preview) + tautan **Lihat di Key Action Matrix**.
- **FR-IB-34** Simulation lain tidak tersentuh.

### 7.5 Integrasi Key Action Matrix
- **FR-IB-40** Tombol **Import / Export BARS** di header halaman Key Action Matrix membuka
  `/dashboard/masters/key-action-bars-import?simulation_id={terpilih}`.
- **FR-IB-41** Halaman Key Action Matrix tetap read-only; data yang di-soft delete tidak tampil
  (query yang ada sudah memfilter `is_deleted = false`).

## 8. API Contract

Prefix `/api`, Bearer JWT wajib.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/key-action-bars/template?simulation_id=` | unduh template `.xlsx` (`simulation_id` opsional, mengisi sheet Info) |
| GET | `/key-action-bars/export?simulation_id=` | unduh data aktif simulation `.xlsx` |
| GET | `/key-action-bars/summary?simulation_id=` | jumlah BARS per tipe + behaviour (FR-IB-03) |
| POST | `/key-action-bars/import/preview` | multipart: `file`, `simulation_id` → `{ summary, errors[], warnings[] }`, tidak menyimpan |
| POST | `/key-action-bars/import` | multipart: `file`, `simulation_id` → `{ summary }`; ada error → 400 dengan `errors[]` |

- Query/body `simulation_id` wajib dideklarasikan di DTO (`whitelist`, `agents.md` §4) dan harus ada di
  `master_simulation` (aktif); tidak ada → 404.
- Format error per baris: `{ row: 7, column: "bars_type", message: "Harus POSITIVE, NETRAL, atau NEGATIVE" }`.
- Upload memakai multer **memory storage** (file tidak ditulis ke `/uploads`).

**Kode error:** `400` file/isi tidak valid · `401` token · `404` simulation tidak ada ·
`413` file terlalu besar · `500` lainnya.

## 9. Validasi (ringkas)

| Tingkat | Aturan |
|---|---|
| File | ekstensi `.xlsx` + isi benar-benar file Excel (zip); ≤ 5 MB; ≤ 5.000 baris data; sheet `BARS` ada; kolom wajib ada di header |
| Baris | kolom wajib terisi; `bars_type` valid; `bars_no`/`behaviour_no` bilangan bulat ≥ 1; `weight` bilangan bulat ≥ 1; `need_ai` nilai yang dikenali; `key_action_id` ada & aktif |
| Antar baris | `bars_name`/`need_ai` konsisten per BARS; (`BARS`, `behaviour_no`) unik; tidak mencampur baris tanpa & dengan behaviour di BARS yang sama |
| Simulation | sheet `Info` (bila ada) cocok dengan simulation terpilih |
| ID | `bars_id` dan `bars_behaviour_id` ≤ 50 karakter |

Semua error dikumpulkan sekaligus (tidak berhenti di error pertama), maksimal 200 ditampilkan + total.

## 10. Keamanan

- Hanya `.xlsx`, dicek ekstensi **dan** isi; batas ukuran & jumlah baris untuk mencegah file raksasa.
- Isi sel diperlakukan sebagai teks biasa; ditampilkan di UI sebagai teks (bukan HTML).
- File diproses di memori dan tidak disimpan di server.
- Audit `created_by`/`modified_by` dari JWT.

## 11. Kebutuhan Non-Fungsional

| Area | Target |
|---|---|
| Kinerja | preview & simpan 1.000 baris ≤ 3 s di lokal |
| Integritas | simpan atomik (1 transaksi); round-trip export → import identik |
| Konsistensi | soft delete, tanpa hapus fisik (FK `RESTRICT` tidak terpicu) |
| Browser | Chrome & Edge terbaru (utama) |

## 12. Catatan Teknis (rekomendasi implementasi)

- Backend: dependensi baru **`exceljs`** (MIT). Modul/berkas baru di `assessment-data` atau modul
  `key-action-bars` terpisah: parser (fungsi murni, mudah diuji), validator, service import (transaksi),
  generator template/export, controller.
- Upsert per ID dengan `save()`/`upsert()` TypeORM dalam `dataSource.transaction`.
- Frontend: halaman `src/app/dashboard/masters/key-action-bars-import/page.tsx`; upload via
  `FormData` + instance `api`; unduh via `responseType: 'blob'` (pola CSV yang ada); menu di `MENUS`.
- Test: unit test parser/validator (Jest) termasuk round-trip; smoke test API di port 3101.

## 13. Kriteria Penerimaan

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| AC-IB-01 | Unduh template | file berisi sheet BARS (header + contoh), Referensi (key action aktif), Petunjuk, dropdown bars_type & need_ai |
| AC-IB-02 | Export simulation `bottleneck` lalu import ulang tanpa diubah | preview: semua "tidak berubah", 0 baru/diubah/dihapus; setelah simpan data identik |
| AC-IB-03 | Upload file valid untuk simulation tanpa BARS (`peluang`) | preview benar; simpan → Key Action Matrix menampilkan data |
| AC-IB-04 | File berisi `bars_type = POSITIF`, `key_action_id` tak dikenal, dan `bars_no` kosong | 3 error dengan nomor baris & kolom; Simpan nonaktif; DB tidak berubah |
| AC-IB-05 | Dua baris BARS sama dengan `bars_name` berbeda | error konsistensi |
| AC-IB-06 | Hapus 1 BARS dari file export lalu import | preview "1 akan dihapus"; setelah simpan BARS & behaviournya `is_deleted = true`, tidak tampil di matrix |
| AC-IB-07 | Upload hasil export `swot` dengan simulation terpilih `csr` | error simulation tidak cocok (FR-IB-24) |
| AC-IB-08 | `weight` & `need_ai` kosong | tersimpan `weight = 1`, `need_ai = true` |
| AC-IB-09 | Baris dengan `behaviour` kosong | BARS tersimpan tanpa behaviour |
| AC-IB-10 | Error terjadi di tengah penyimpanan (mis. DB putus) | rollback, tidak ada perubahan parsial |
| AC-IB-11 | File `.xls`/`.csv`/PDF berganti nama `.xlsx`, atau > 5 MB | 400 / 413 dengan pesan jelas |
| AC-IB-12 | Teks berisi zero-width space | tersimpan tanpa karakter tersebut |
| AC-IB-13 | Tombol di Key Action Matrix | membuka halaman import dengan simulation yang sama |

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Salah pilih simulation | data simulation lain tertimpa | sheet `Info` + pengecekan (FR-IB-24), preview menampilkan nama simulation & jumlah yang akan dihapus |
| Mode ganti menghapus data yang tidak sengaja dihilangkan dari file | BARS hilang dari matrix | soft delete (bisa dipulihkan via DB), preview "akan dihapus" ditonjolkan |
| ID > 50 karakter untuk key action/simulation ber-ID panjang | import gagal | validasi panjang ID + pesan jelas |
| Excel diedit dengan format sel aneh (angka sebagai teks, formula) | salah baca | baca nilai hasil formula, normalisasi angka/teks, validasi ketat |
| Dependensi baru | ukuran/kerentanan | `exceljs` aktif dirawat, hanya di backend |

## 15. Rencana Rilis

| Fase | Isi |
|---|---|
| **1 — Backend** ✅ | `exceljs`, parser + validator (fungsi murni + unit test), endpoint preview/import transaksional, template, export, summary |
| **2 — Frontend** ✅ | menu & halaman Import BARS (pilih simulation, unduh template/export, preview, simpan), tombol pintas di Key Action Matrix |

**Prasyarat:** fitur Key Action Matrix yang saat ini masih berupa perubahan lokal (belum di-commit)
sebaiknya di-commit/di-merge lebih dulu karena modul ini memakai entity dan halamannya.

## 16. Keputusan (dikonfirmasi user, 2026-11-22)

1. Format: **1 sheet datar, 1 baris = 1 behaviour**; ID dibuat sistem.
2. Mode: **ganti per simulation**; data lama yang tidak ada di file di-**soft delete**.
3. **Preview dulu**, simpan semua atau tidak sama sekali.
4. Pendukung: **unduh template** dan **export data**.
5. UI: **menu terpisah** + **tombol pintas** di Key Action Matrix.
6. Library: **`exceljs`**.
7. BARS **boleh tanpa behaviour**; `need_ai` kosong = **TRUE**; `weight` kosong = **1**.
8. Key action dicocokkan **hanya via `key_action_id`**; key action yang tidak ada → error (tidak dibuat otomatis).
9. Batas file **5 MB / 5.000 baris data** per upload.
10. `weight` bilangan bulat **≥ 1** (kosong = 1).
11. `bars_id`/`bars_behaviour_id` > 50 karakter → **error baris**, tidak dipendekkan otomatis.
12. Peringatan "key action aktif yang tidak punya BARS di file" **tidak dibuat** untuk saat ini.
