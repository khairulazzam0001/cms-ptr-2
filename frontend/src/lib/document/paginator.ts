// Paginator A4 (PRD Document Generator §6.3). Fungsi murni: menerima tinggi blok hasil ukur DOM,
// mengembalikan pembagian halaman. Dipakai untuk tampilan editor, payload simpan, dan preview (FR-28).

// Unit yang tidak boleh dipecah: satu item list, atau satu/lebih baris tabel yang terikat rowspan.
export type Unit = { from: number; to: number; h: number };

// Kontrol widow/orphan: minimal baris paragraf di bawah halaman & di awal halaman berikutnya
export const MIN_LINES = 2;

export type BlockMeasure =
  // h sudah termasuk margin-bottom (mb); pageBreak = node page break manual.
  // lines (hanya paragraf): baris-baris paragraf, diukur malas hanya bila paragraf perlu dipecah.
  //   Unit.from/to = offset konten ProseMirror awal/akhir baris.
  | { kind: 'block'; h: number; mb: number; pageBreak?: boolean; lines?: () => Unit[] }
  // overhead = tinggi tabel di luar baris (border, dsb.); headerH > 0 bila baris pertama adalah header
  | { kind: 'table'; overhead: number; mb: number; units: Unit[]; headerH: number }
  | { kind: 'list'; overhead: number; mb: number; units: Unit[] };

// Bagian blok di satu halaman. from/to (eksklusif) = indeks baris tabel / item list, atau offset
// konten paragraf; tanpa from = blok utuh.
export type Fragment = { index: number; from?: number; to?: number };

// Awal halaman baru: sebelum blok `index`, atau sebelum baris/item `sub` di dalam blok tsb.
// remaining = sisa ruang (px) di halaman sebelumnya. reserve = overhead + header tabel yang diulang di awal
// halaman lanjutan (tidak tampil di editor, tetapi ada di data simpan/preview; editor menyisakan ruangnya).
export type PageStart = { index: number; sub?: number; remaining: number; reserve?: number };

export type Layout = {
  pages: Fragment[][];
  starts: PageStart[];
  overflow: { index: number; sub?: number }[];
  lastUsed: number;
};

export function paginate(blocks: BlockMeasure[], contentHeight: number): Layout {
  const pages: Fragment[][] = [[]];
  const starts: PageStart[] = [];
  const overflow: Layout['overflow'] = [];
  let used = 0;
  let forceBreak = false;

  const current = () => pages[pages.length - 1];
  const newPage = (index: number, sub?: number, reserve = 0) => {
    starts.push({ index, sub, remaining: contentHeight - used, ...(reserve > 0 ? { reserve } : {}) });
    pages.push([]);
    used = 0;
  };

  // Pecah paragraf per baris dengan kontrol widow/orphan (MIN_LINES di tiap potongan)
  const splitLines = (index: number, lines: Unit[]) => {
    const n = lines.length;
    let g = 0;
    while (g < n) {
      let h = 0;
      let k = g;
      while (k < n && used + h + lines[k].h <= contentHeight) {
        h += lines[k].h;
        k++;
      }
      if (k < n && n - k < MIN_LINES) k = n - MIN_LINES; // sisakan minimal 2 baris untuk halaman berikutnya
      if (k < n && k - g < MIN_LINES) {
        if (used > 0) {
          newPage(index, g === 0 ? undefined : lines[g].from);
          continue;
        }
        // halaman kosong tapi 2 baris pun tidak muat (font sangat besar): ambil yang muat, minimal 1
        k = Math.max(g + 1, Math.min(k, n));
      }
      h = lines.slice(g, k).reduce((s, l) => s + l.h, 0);
      if (h > contentHeight) overflow.push({ index, sub: lines[g].from });
      current().push(g === 0 && k === n ? { index } : { index, from: lines[g].from, to: lines[k - 1].to });
      used += h;
      g = k;
      if (g < n) newPage(index, lines[g].from);
    }
  };

  blocks.forEach((b, index) => {
    if (forceBreak) {
      newPage(index);
      forceBreak = false;
    }

    if (b.kind === 'block') {
      // margin-bottom blok terakhir boleh melewati batas halaman
      const body = b.h - b.mb;
      if (b.lines && used + body > contentHeight) {
        const lines = b.lines();
        if (lines.length >= 2 * MIN_LINES) {
          splitLines(index, lines);
          used += b.mb;
          return;
        }
      }
      if (used > 0 && used + body > contentHeight) newPage(index);
      current().push({ index });
      if (body > contentHeight) overflow.push({ index }); // FR-26
      used += b.h;
      forceBreak = !!b.pageBreak;
      return;
    }

    const { units } = b;
    const whole = b.overhead + units.reduce((s, u) => s + u.h, 0);
    if (units.length === 0 || used + whole <= contentHeight) {
      current().push({ index });
      used += whole + b.mb;
      return;
    }

    // Pecah per unit (FR-23 baris tabel, FR-24 item list). Header tabel diulang di halaman lanjutan.
    const repeatH = b.kind === 'table' ? b.headerH : 0;
    let g = 0;
    while (g < units.length) {
      const continued = g > 0;
      let h = b.overhead + (continued ? repeatH : 0);
      let k = g;
      while (k < units.length && used + h + units[k].h <= contentHeight) {
        h += units[k].h;
        k++;
      }

      // Header jangan tertinggal sendirian di bawah halaman
      if (!continued && repeatH > 0 && k === 1 && units.length > 1 && used > 0) {
        k = g;
        h = b.overhead;
      }

      if (k === g) {
        if (used > 0) {
          newPage(index, continued ? units[g].from : undefined);
          continue;
        }
        // Halaman kosong tapi unit tetap tidak muat: taruh sendiri, tandai melebihi halaman
        overflow.push({ index, sub: units[g].from });
        h += units[g].h;
        k = g + 1;
      }

      current().push(g === 0 && k === units.length ? { index } : { index, from: units[g].from, to: units[k - 1].to });
      used += h;
      g = k;
      // potongan lanjutan punya overhead (border) + header sendiri di data simpan/preview
      if (g < units.length) newPage(index, units[g].from, b.overhead + repeatH);
    }
    used += b.mb;
  });

  return { pages, starts, overflow, lastUsed: used };
}

// Kelompokkan baris tabel yang terikat rowspan menjadi satu unit (baris tidak pernah dipecah).
// rowSpans[r] = daftar rowspan sel di baris r.
export function groupRows(rowSpans: number[][], heights: number[]): Unit[] {
  const units: Unit[] = [];
  let start = 0;
  let reach = 0;
  rowSpans.forEach((spans, r) => {
    reach = Math.max(reach, r + Math.max(1, ...spans));
    if (reach <= r + 1) {
      units.push({ from: start, to: r + 1, h: heights.slice(start, r + 1).reduce((s, x) => s + x, 0) });
      start = r + 1;
    }
  });
  if (start < rowSpans.length) {
    units.push({ from: start, to: rowSpans.length, h: heights.slice(start).reduce((s, x) => s + x, 0) });
  }
  return units;
}
