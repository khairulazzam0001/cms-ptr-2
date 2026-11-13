# PRD — Copy Assessment Design

| | |
|---|---|
| Produk | CMS Data Master (cms-ptr-2) |
| Modul | Master Assessment Design — aksi **Copy** di halaman `/dashboard/masters/assessment-designs` |
| Status | Terimplementasi (2026-11-13) — dokumen ini merangkum perilaku berjalan + backlog |
| Tanggal | 2026-11-13 |
| Terkait | `PRD_Document_Generator.md`, `PRD_Upload_Document.md`, `agents.md` §1–§2a |
| Stack | Backend NestJS 10 + TypeORM + MySQL · Frontend Next.js 14 + Tailwind + Axios (tanpa dependensi baru) |
| Endpoint | `POST /api/assessment-designs/:id/copy` |

---

## 1. Latar Belakang & Tujuan

Membuat assessment design baru dari nol membutuhkan waktu lama: admin harus mengisi design,
level, detail competency, detail simulation, lalu seluruh data turunannya (folder, actor,
activity, scenario activity, chat, call, email + attachment, dokumen + isi halaman, dan mapping
group rating). Sebagian besar design baru merupakan **variasi** dari design yang sudah ada
(beda level, beda skenario, atau tambahan simulasi).

Fitur **Copy** menyediakan deep clone satu assessment design beserta seluruh data turunannya
dalam satu klik, sehingga admin hanya perlu menyesuaikan bagian yang berbeda. Data sumber
**tidak berubah sama sekali**.

**Tujuan**
1. Admin dapat menggandakan satu assessment design beserta data turunannya langsung dari list.
2. Hasil copy adalah data **terisolasi**: ID baru, relasi baru, perubahan pada salinan tidak
   memengaruhi data sumber (dan sebaliknya).
3. Seluruh proses berjalan **atomik**: berhasil semua, atau tidak ada data setengah jadi.
4. Konvensi ID dan penamaan konsisten (`-COPY`, `-COPY2`, …; nama diberi label `(Copy)`).

**Metrik keberhasilan**
- Satu klik menghasilkan assessment design baru yang bisa langsung dibuka di halaman
  View Competency / View Simulation tanpa error.
- Jumlah baris tiap tabel turunan pada hasil copy = jumlah baris aktif pada sumber
  (sesuai cakupan pada §7).
- Tidak ada baris sumber yang berubah (`modified_date`, `revision`, isi) setelah copy.
- Jika proses gagal di tengah, tidak ada baris hasil copy yang tertinggal.

## 2. Ruang Lingkup

### 2.1 Termasuk
- Tombol **Copy** di kolom Action pada list assessment design.
- Dialog konfirmasi yang menjelaskan cakupan data yang digandakan.
- Endpoint `POST /api/assessment-designs/:id/copy` (JWT).
- Deep clone 15 tabel: `master_design`, `master_assessment_design`,
  `master_assessment_design_detail_competency`,
  `master_assessment_design_detail_simulation`, `master_folder`, `master_actor`,
  `master_activity`, `master_document`, `master_document_content`,
  `master_scenario_activity`, `master_chat`, `master_call`, `master_email`,
  `master_email_attachment`, `ref_mapping_group_rating`.
- Pembuatan ID baru + penamaan otomatis, dan remap seluruh foreign key.
- Ringkasan hasil copy (jumlah baris per tabel) setelah proses selesai.
- Refresh list ke halaman 1 setelah copy berhasil.

### 2.2 Tidak termasuk
- Memilih sebagian data yang dicopy (mis. hanya simulation tertentu) — saat ini selalu **semua**.
- Menentukan sendiri ID/nama hasil copy dari UI.
- Menyalin ke assessment design yang sudah ada (copy selalu membuat assessment design **baru**).
- Menyalin tabel transaksi/relasi di luar cakupan: `trans_batch_project`, `trans_participant`,
  `trans_participant_assessor`, `master_key_action`, dan tabel referensi
  (`ref_activity_type`, `ref_group_rating`, `master_prompt`, `master_competency`,
  `master_simulation`, `master_level`).
- Menyalin data yang sudah di-soft-delete (`is_deleted = true`).
- Job asinkron/progress bar/riwayat copy.
- Edit/hapus hasil copy langsung dari dialog hasil (dilakukan dari list seperti data biasa).

## 3. Pengguna & Hak Akses

| Aktor | Keterangan |
|---|---|
| Admin (single user) | Satu-satunya pengguna. Login JWT yang sudah ada. |

- Semua route berada di balik `JwtAuthGuard` global; tanpa token → `401`.
- `created_by` / `modified_by` baris hasil copy diisi username dari JWT
  (`@CurrentUsername()`), fallback `'admin'` bila tidak tersedia.

## 4. User Stories

| ID | Sebagai admin, saya ingin… | Supaya… |
|---|---|---|
| AC-01 | menekan tombol **Copy** pada satu baris assessment design | mendapat salinan lengkap tanpa mengisi ulang dari nol |
| AC-02 | melihat konfirmasi berisi cakupan data sebelum copy dijalankan | tidak tanpa sengaja membuat data ganda |
| AC-03 | melihat indikator proses saat copy berjalan | tahu sistem sedang bekerja dan tidak menekan tombol dua kali |
| AC-04 | mendapat ringkasan jumlah data hasil copy | yakin seluruh data turunan ikut tergandakan |
| AC-05 | melihat hasil copy langsung muncul di list | bisa segera membuka detail/competency/simulation-nya |
| AC-06 | menyalin ulang design yang sudah pernah dicopy | mendapat salinan kedua, ketiga, dst. tanpa bentrok ID |
| AC-07 | yakin data sumber tidak berubah | membandingkan design asal dan variasinya dengan aman |

## 5. Alur Pengguna (UI)

1. Admin membuka `/dashboard/masters/assessment-designs`.
2. Pada kolom **Action** setiap baris tersedia tombol `View Competency`,
   `View Simulation`, **`Copy`**, `Edit`, `Delete`.
3. Klik `Copy` → muncul dialog konfirmasi:
   ```
   Copy assessment design {id} beserta seluruh data terkait?

   Design, detail competency/simulation, actor, folder, activity, scenario, chat,
   email, dan dokumen akan digandakan dengan ID baru.
   ```
4. **Batal** → tidak ada request. **OK** → tombol berubah menjadi `Copying...`
   dan **semua** tombol Copy pada list dinonaktifkan (mencegah copy paralel dari UI).
5. Setelah selesai → dialog ringkasan:
   ```
   Copy selesai.

   Assessment Design : {assessment_design_id}
   Nama              : {assessment_design_name}
   Design            : {design_id}

   Activity   : n
   Scenario   : n
   Chat       : n
   Email      : n (+n attachment)
   Dokumen    : n (n halaman)
   Actor      : n
   Folder     : n
   ```
6. List otomatis di-refresh ke **halaman 1** dengan kata kunci pencarian yang sedang aktif.
7. Jika gagal → dialog error berisi pesan dari API
   (default: `Gagal copy assessment design`).

### 5.1 State tombol

| Kondisi | Tampilan |
|---|---|
| Normal | `Copy` (aktif) |
| Baris sedang diproses | `Copying...` (disabled) |
| Ada proses copy lain berjalan | Semua tombol Copy `disabled` |

## 6. Definisi

| Istilah | Arti |
|---|---|
| **Deep clone** | Menyalin baris induk **dan** seluruh baris turunannya, bukan hanya header |
| **Data turunan** | Folder, actor, activity, scenario, chat, call, email + attachment, dokumen + konten, mapping rating |
| **Remap relasi** | Nilai FK pada baris salinan diganti ID baru hasil copy (bukan ID sumber) |
| **Referensi bersama** | FK yang **tidak** digandakan, tetap menunjuk baris master/referensi yang sama (competency, simulation, level, activity type, prompt, group rating) |
| **Soft delete** | Penghapusan logis via `is_deleted = true`; baris seperti ini tidak ikut dicopy |

## 7. Data yang Dicopy

Semua pembacaan hanya mengambil baris `is_deleted = false`.

| # | Tabel | Sumber baris | ID hasil copy | Relasi yang di-remap | Catatan |
|---|---|---|---|---|---|
| 1 | `master_design` | design milik assessment design sumber | `<design_id>-COPY` | — | Field `design_desc`, `design_background(_md)`, `instruction(_md)` ikut |
| 2 | `master_assessment_design` | baris sumber | `<assessment_design_id>-COPY` | `design_id` → design baru | `level_id`, `time_reminder`, `range_per_simulation` ikut |
| 3 | `..._detail_competency` | detail aktif milik sumber | `${newAdId}_${competency_id}` | `assessment_design_id` → baru | `competency_id` **referensi bersama** |
| 4 | `..._detail_simulation` | detail aktif milik sumber | `${newAdId}_${simulation_id}` | `assessment_design_id` → baru | `sequence` dipertahankan; dipakai untuk remap mapping |
| 5 | `master_folder` | folder `design_id` + `level_id` sumber, plus folder yang dipakai dokumen | `<folder_id>-COPY` | `design_id` → baru; `owner` → actor baru; `assessment_design_id` → baru hanya bila asalnya menunjuk sumber | `folder_name`, `sort`, `level_id` ikut |
| 6 | `master_actor` | actor `design_id` + `level_id` sumber, **plus** actor yang direferensikan scenario/chat/call/email/dokumen/folder, **plus** rantai `superior` | `<actor_id>-COPY` | `design_id` → baru; `superior` → actor baru (bila ikut tercopy); `level_id` ikut | `superior` di-update pada pass kedua |
| 7 | `master_activity` | activity `design_id` + `level_id` sumber yang `simulation_id` ∈ detail simulation **atau** `simulation_id` NULL | `<activity_id>-COPY` | `design_id` → baru; `simulation_id`, `ref_activity_type_id` **referensi bersama** | `is_first`, `state_name`, deskripsi ikut |
| 8 | `master_document` | dokumen dengan `activity_id` ∈ activity tercopy, `document_id` dari scenario, `document_id` dari lampiran email | `<document_id>-COPY` | `folder_id`, `activity_id`, `owner` → hasil copy (NULL bila pasangan tidak tercopy) | `status`, `is_active`, `read_only`, `page_count`, 6 kolom header/footer, `hide_header_footer_first_page` ikut; `revision` di-reset `0` |
| 9 | `master_document_content` | seluruh halaman aktif dari dokumen tercopy | UUID baru (auto) | `document_id` → dokumen baru | `page`, `content_html`, `document_content_md` ikut; dipakai untuk remap attachment |
| 10 | `master_scenario_activity` | scenario dari activity tercopy | `<scenario_activity_id>-COPY` | `activity_id`, `triggered_activity_id`, `actor_id`, `target_actor_id`, `document_id` | `timer`, `status`, `need_reply`, `target_activity_type`, `trigger_timer` ikut; `prompt_id` **referensi bersama** |
| 11 | `master_chat` | chat dari activity tercopy | `<chat_id>-COPY` | `activity_id`, `actor_id` | `chat_name`, `content` ikut |
| 12 | `master_call` | call dari activity tercopy | `<call_id>-COPY` | `activity_id`, `actor_id` | `call_name`, `content` ikut |
| 13 | `master_email` | email dari activity tercopy | `<email_id>-COPY` | `activity_id`, `parent_activity_id`, `actor_from/to/cc` | `email_type`, `subject`, `content`, `email_name` ikut |
| 14 | `master_email_attachment` | attachment dari email tercopy | `<attachment_id>-COPY` | `email_id` → email baru; `doc_content_id` → konten dokumen baru | Lampiran read-only (`read_only='document'`) ikut tercopy sebagai dokumen terpisah |
| 15 | `ref_mapping_group_rating` | mapping dari detail simulation sumber | `<mapping_group_rating_id>-COPY` | `assessment_design_detail_simulation_id` → detail sim baru | `group_rating_id` **referensi bersama** |

### 7.1 Referensi yang sengaja **tidak** digandakan

`level_id`, `competency_id`, `simulation_id`, `ref_activity_type_id`, `prompt_id`,
`group_rating_id`, serta seluruh tabel referensi. Alasannya: baris tersebut adalah katalog
bersama, bukan milik satu design. Perubahan katalog berlaku untuk sumber dan salinan.

### 7.2 Data yang sengaja **tidak** dicopy

- Baris dengan `is_deleted = true` (dianggap sudah dihapus admin).
- `trans_batch_project`, `trans_participant`, `trans_participant_assessor`
  (data runtime project/peserta, bukan definisi design).
- `master_key_action` (belum dipakai UI).
- Berkas fisik di `/uploads` (hanya referensi dokumen yang dicopy; tidak ada duplikasi file).

## 8. Aturan Penamaan & ID

### 8.1 ID

| Objek | Pola | Contoh |
|---|---|---|
| Design, assessment design, folder, actor, activity, document, scenario, chat, call, email, attachment, mapping | `<id sumber>-COPY`, lalu `<id sumber>-COPY2`, `-COPY3`, … | `DSG-AMBJ-COPY`, `DSG-AMBJ-COPY2` |
| Detail competency / detail simulation | `${newAdId}_${childId}`; bila sudah terpakai diberi `-2`, `-3`, … | `AD-001-COPY_COMP_DDI_BA` |

- Panjang ID maksimum **50 karakter** (`varchar(50)`). Pemotongan dilakukan pada bagian
  pangkal agar suffix `-COPY`/`-COPY2`/`-2` tetap utuh.
- Pemeriksaan bentrok memakai **seluruh ID yang ada di tabel**, termasuk baris soft-deleted
  (karena PK tetap unik).

### 8.2 Nama

| Kolom | Panjang maks | Pola |
|---|---|---|
| `design_name` | 100 | `<nama dasar> (Copy)`, `<nama dasar> (Copy 2)`, dst. |
| `assessment_design_name` | 150 | idem |
| `document_name` | 150 | idem |

- Label mengikuti nomor pada ID hasil copy (`-COPY2` → ` (Copy 2)`).
- Label ` (Copy)` / ` (Copy N)` lama **dibuang dulu** dari nama sumber agar tidak menumpuk
  (copy dari hasil copy tetap `(Copy 2)`, bukan `(Copy) (Copy)`).
- Nama dipotong bila melebihi panjang kolom, dengan label tetap dipertahankan.

## 9. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-AC-01 | List assessment design menampilkan tombol **Copy** di kolom Action setiap baris | Wajib |
| FR-AC-02 | Klik Copy menampilkan konfirmasi berisi ID dan cakupan data; Batal = tidak ada request | Wajib |
| FR-AC-03 | Konfirmasi menjalankan `POST /api/assessment-designs/:id/copy` dengan header Bearer | Wajib |
| FR-AC-04 | Saat proses berjalan, tombol aktif menampilkan `Copying...` dan seluruh tombol Copy nonaktif | Wajib |
| FR-AC-05 | Backend membuat design baru + assessment design baru + seluruh data turunan sesuai §7 | Wajib |
| FR-AC-06 | Seluruh FK pada salinan di-remap ke ID hasil copy; referensi bersama tetap | Wajib |
| FR-AC-07 | Backend mengembalikan ringkasan (`assessment_design_id`, nama, `design_id`, `counts`) | Wajib |
| FR-AC-08 | Frontend menampilkan ringkasan hasil dan me-refresh list ke halaman 1 | Wajib |
| FR-AC-09 | Copy berulang menghasilkan `-COPY2`, `-COPY3`, … dan nama `(Copy 2)`, `(Copy 3)`, … | Wajib |
| FR-AC-10 | Proses berjalan dalam satu transaksi DB; gagal = rollback penuh | Wajib |
| FR-AC-11 | Sumber tidak ditemukan / sudah dihapus → `404` dengan pesan jelas | Wajib |
| FR-AC-12 | Design induk sumber tidak ditemukan → `400` dengan pesan jelas | Wajib |
| FR-AC-13 | Error lain ditampilkan ke admin lewat dialog (tidak silent) | Wajib |
| FR-AC-14 | ID hasil copy tidak pernah melebihi 50 karakter | Wajib |
| FR-AC-15 | Baris hasil copy memakai `created_by`/`modified_by` dari JWT dan `is_deleted = false` | Wajib |
| FR-AC-16 | Salinan dokumen dimulai dengan `revision = 0` (riwayat revisi tidak diwarisi) | Wajib |
| FR-AC-17 | Fitur dapat menjelaskan/menolak copy jika data sumber tidak konsisten (mis. parent hilang) | Sebaiknya |

## 10. API Contract

### 10.1 `POST /api/assessment-designs/:id/copy`

| Item | Nilai |
|---|---|
| Auth | Bearer JWT (wajib) |
| Path param | `id` = `assessment_design_id` sumber |
| Body | — (kosong) |
| Content-Type | tidak diperlukan |
| Sifat | Non-idempoten: setiap panggilan membuat satu salinan baru |

**Response 201 (ringkas)**

```json
{
  "source_assessment_design_id": "AD-AMBJ-01",
  "assessment_design_id": "AD-AMBJ-01-COPY",
  "assessment_design_name": "Assessment Amboja (Copy)",
  "design_id": "DSG-AMBJ-COPY",
  "design_name": "Design Amboja (Copy)",
  "counts": {
    "master_design": 1,
    "master_assessment_design": 1,
    "master_assessment_design_detail_competency": 3,
    "master_assessment_design_detail_simulation": 9,
    "master_folder": 2,
    "master_actor": 51,
    "master_activity": 210,
    "master_document": 24,
    "master_document_content": 36,
    "master_scenario_activity": 480,
    "master_chat": 63,
    "master_call": 0,
    "master_email": 79,
    "master_email_attachment": 10,
    "ref_mapping_group_rating": 0
  }
}
```

Catatan: angka di atas hanya ilustrasi; nilainya mengikuti data sumber. Kunci `counts`
untuk seluruh tabel turunan selalu dikembalikan (bisa bernilai `0`); kunci `master_design`
hanya ada bila assessment design sumber memiliki `design_id`.

### 10.2 Kode error

| Kode | Kondisi | Body |
|---|---|---|
| `401` | Token tidak ada/kedaluwarsa | standar guard |
| `404` | Assessment design sumber tidak ada atau `is_deleted = true` | `Assessment design {id} tidak ditemukan` |
| `400` | `design_id` sumber menunjuk design yang tidak ada/terhapus | `Design {design_id} milik assessment design ini tidak ditemukan` |
| `500` | Gagal DB / pelanggaran constraint saat menulis | error Nest default; transaksi di-rollback |

### 10.3 Perilaku transaksi

- Seluruh proses dibungkus `dataSource.transaction()`.
- Bila satu insert gagal (mis. ID bentrok karena copy paralel), semua insert dibatalkan.
- Tidak ada mekanisme retry otomatis di server; admin cukup menekan Copy lagi.

## 11. Aturan Bisnis Tambahan

1. **Cakupan activity** = activity milik design sumber pada level yang sama **dan**
   (`simulation_id` NULL **atau** ada di daftar detail simulation sumber). Activity dengan
   simulasi lain tidak ikut, sehingga scenario/chat/call/email miliknya juga tidak ikut.
2. **Cakupan actor** = actor design + level sumber, ditambah actor yang disebut pada data
   turunan (scenario actor & target actor, chat, call, email from/to/cc, owner dokumen,
   owner folder), ditambah rantai atasannya. Actor dari design/level lain hanya ikut bila
   direferensikan.
3. **Folder** = folder design + level sumber, ditambah folder yang dipakai dokumen tercopy
   walaupun beda level.
4. **Dokumen** hanya yang terkait activity, scenario, atau lampiran email pada cakupan di atas,
   dan hanya diproses bila assessment design sumber memiliki `design_id`.
   Dokumen yatim (tanpa relasi tersebut) tidak ikut.
5. **Level** assessment design sumber dipakai apa adanya. Bila `level_id` kosong, filter level
   tidak diterapkan pada activity/actor/folder.
6. **Isi dokumen** (HTML per halaman) disalin verbatim tanpa sanitasi ulang maupun perubahan;
   dokumen upload read-only tetap read-only.
7. **Soft-deleted parent** tidak "dihidupkan" — baris tersebut dilewati, dan relasi opsional
   yang menunjuk ke sana menjadi `NULL`.
8. **Audit** baris baru: `created_by`/`modified_by` = user pelaku, tanggal otomatis,
   `is_deleted = false`.

## 12. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Konsistensi | Atomik (satu transaksi), tidak ada data parsial |
| Keamanan | Endpoint di balik JWT; tidak menerima input nama/ID dari klien; tidak mengeksekusi HTML dokumen |
| Kinerja | Copy design besar (ratusan scenario/email, puluhan dokumen) selesai dalam hitungan detik–puluhan detik; operasi berjalan sinkron dalam satu request |
| Kapasitas | ID selalu ≤ 50 karakter; nama selalu ≤ panjang kolom |
| Auditabilitas | Semua baris baru mencatat pelaku di `created_by`/`modified_by` |
| UX | Proses terlihat (label `Copying...`), hasil terlihat (ringkasan), kegagalan terlihat (dialog error) |
| Kompatibilitas | Tidak menambah tabel/kolom/dependensi baru; memakai struktur yang sudah ada |

## 13. Kriteria Penerimaan

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Buka list assessment design | Tombol `Copy` tampil di setiap baris kolom Action |
| 2 | Klik Copy lalu Batal | Tidak ada request, data tidak berubah |
| 3 | Klik Copy lalu OK | Request `POST .../copy` terkirim dengan Bearer; tombol jadi `Copying...`; tombol Copy lain nonaktif |
| 4 | Copy berhasil | Assessment design baru `<id>-COPY` dan design baru `<id>-COPY` muncul; nama berlabel `(Copy)` |
| 5 | Buka **View Competency** hasil copy | Jumlah dan isi competency sama dengan sumber |
| 6 | Buka **View Simulation** hasil copy | Jumlah simulation & urutan `sequence` sama dengan sumber |
| 7 | Buka salah satu dokumen hasil copy | ID baru (`-COPY`), isi halaman sama, `revision = 0` |
| 8 | Buka email hasil copy beserta lampiran | Subject/content sama; lampiran menunjuk konten dokumen hasil copy |
| 9 | Periksa actor & folder | ID baru; `superior` dan `owner` menunjuk actor/folder hasil copy (bukan sumber) |
| 10 | Copy design yang sudah pernah dicopy | Muncul `-COPY2`, nama `(Copy 2)`; label lama tidak menumpuk |
| 11 | Bandingkan dengan sumber | Tidak ada baris sumber yang berubah (`modified_date`, isi, `revision` tetap) |
| 12 | Copy design yang sudah di-soft-delete | `404` dengan pesan "tidak ditemukan"; tidak ada baris baru |
| 13 | Simulasikan kegagalan di tengah proses | Tidak ada baris hasil copy yang tersisa (rollback) |
| 14 | Copy design berukuran besar | Proses selesai tanpa timeout; ringkasan menampilkan jumlah baris yang wajar |
| 15 | Setelah copy berhasil | List refresh ke halaman 1 dan baris baru terlihat |

## 14. Batasan & Catatan (kondisi saat ini)

1. **Sinkron & tanpa progress**: satu request menunggu seluruh insert selesai. Design sangat
   besar berisiko melewati timeout browser/proxy; belum ada job antrean.
2. **Tidak ada pilihan subset**: selalu menyalin semua data dalam cakupan §7.
3. **Tidak bisa menentukan nama/ID sendiri**: ID dan nama dihasilkan otomatis.
4. **Selalu menggandakan `master_design`**: dua assessment design yang asalnya berbagi satu
   design akan menjadi dua design terpisah setelah copy (isolasi sengaja, tetapi menambah
   duplikasi data master).
5. **Referensi bersama**: `prompt_id` dan `group_rating_id` tetap menunjuk baris katalog yang
   sama; perubahan katalog berdampak ke sumber **dan** salinan.
6. **Data luar cakupan**: batch project/peserta/assessor dan `master_key_action` tidak ikut.
7. **Filter level**: activity/actor/folder dari level lain tidak ikut kecuali direferensikan;
   ini bisa terasa seperti data "hilang" pada design dengan data lintas level.
8. **Konsistensi sumber**: bila `page_count` sumber tidak sama dengan jumlah baris konten aktif,
   nilai `page_count` tetap disalin apa adanya (mengikuti data sumber).
9. **Tombol Copy global**: satu proses copy menonaktifkan tombol Copy seluruh list
   (belum ada antrean/paralel dari UI).
10. **Idempotensi**: klik ganda dari klien lain (bukan UI ini) tetap menghasilkan salinan baru.

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Copy design besar melebihi waktu request | Admin melihat error padahal data mungkin sudah ditulis | Transaksi memastikan rollback; naikkan timeout proxy bila perlu |
| ID bentrok saat dua admin copy bersamaan | Insert gagal di tengah | Transaksi + pengecekan ID dari DB; admin mengulang |
| Data sumber tidak konsisten (parent hilang) | Sebagian relasi menjadi `NULL` | Validasi design induk → `400`; relasi opsional `NULL` didokumentasikan |
| Duplikasi master design menumpuk | Tabel master membengkak | Diterima sebagai konsekuensi isolasi; bisa dibersihkan manual/soft delete |
| Kebingungan label `(Copy 2)` | Admin sulit membedakan varian | Label mengikuti nomor ID dan tidak menumpuk |

## 16. Rencana Pengembangan Lanjutan (backlog)

Prioritas dari atas, dikerjakan hanya bila diminta:

1. **Opsi cakupan copy** (mis. tanpa dokumen / tanpa data runtime) dan **nama/ID kustom**.
2. **Progress/async job** untuk design besar + notifikasi selesai.
3. **Copy ke design yang sudah ada** (attach assessment design baru ke design lama tanpa
   menggandakan `master_design`).
4. **Deep copy katalog** opsional untuk `master_prompt` / `group_rating` bila admin ingin
   salinan terisolasi penuh.
5. **Riwayat copy** (siapa, kapan, sumber → hasil) untuk audit.
6. **Copy lintas level** dengan pemetaan actor/activity/folder yang eksplisit.
7. **Dry-run/preview** jumlah baris yang akan dibuat sebelum eksekusi.

## 17. Lampiran — Pemetaan Implementasi

| Bagian | Lokasi kode |
|---|---|
| Endpoint | `backend/src/modules/assessment/controllers.ts` — `POST :id/copy` |
| Logika deep clone | `backend/src/modules/assessment/assessment-copy.service.ts` |
| Aturan ID/nama | fungsi `copyId`, `uniqueId`, `withCopyName`, `copyLabel` (file yang sama) |
| Registrasi provider | `backend/src/modules/assessment/assessment.module.ts` |
| UI tombol & dialog | `frontend/src/app/dashboard/masters/assessment-designs/page.tsx` — `copyDesign()` |
| Tabel & entity | `backend/src/modules/assessment/entities.ts`, `backend/src/modules/assessment-data/entities.ts`, `backend/src/modules/documents/document.entity.ts` |
| Konvensi umum (ID, soft delete, audit, paging) | `agents.md` §4 |

### 17.1 Contoh urutan penulisan (dependency order)

```
master_design
  → master_assessment_design
    → detail competency
    → detail simulation
    → master_folder (owner di-update setelah actor)
    → master_actor (superior di-update setelah semua actor)
    → master_activity
    → master_document
      → master_document_content
    → master_scenario_activity
    → master_chat
    → master_call
    → master_email
      → master_email_attachment (butuh contentMap)
    → ref_mapping_group_rating (butuh detailSimMap)
```

Urutan ini penting: remap FK hanya bisa dilakukan setelah baris tujuan punya ID baru.
