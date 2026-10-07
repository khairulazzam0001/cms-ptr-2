// Ukur tinggi blok level atas di DOM editor -> input paginator.
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { isHeaderRow } from './html';
import { BlockMeasure, groupRows, Unit } from './paginator';

// Elemen dekorasi paginator / gapcursor bukan node dokumen
const SKIP_CLASSES = ['pg-spacer', 'ProseMirror-gapcursor'];

// Tinggi tambahan dari dekorasi awal halaman di tengah tabel/list/paragraf (lihat pagination.ts)
const extra = (el: Element) => Number((el as HTMLElement).dataset.pbExtra || 0);
const height = (el: Element) => el.getBoundingClientRect().height;

export function measureBlocks(view: EditorView): BlockMeasure[] | null {
  const root = view.dom as HTMLElement;
  const doc = view.state.doc;
  const els = Array.from(root.children).filter((el) => !SKIP_CLASSES.some((c) => el.classList.contains(c)));
  if (els.length !== doc.childCount) return null;
  const positions: number[] = [];
  doc.forEach((_, offset) => positions.push(offset));

  return els.map((el, i): BlockMeasure => {
    const node = doc.child(i);
    const mb = parseFloat(getComputedStyle(el).marginBottom) || 0;
    const h = height(el);

    if (node.type.name === 'table') {
      const table = (el.tagName === 'TABLE' ? el : el.querySelector('table')) as HTMLTableElement | null;
      if (!table) return { kind: 'block', h: h + mb, mb };
      const rows = Array.from(table.rows);
      const raw = rows.map(height);
      const heights = rows.map((r, j) => raw[j] - extra(r));
      const units = groupRows(rows.map((r) => Array.from(r.cells).map((c) => c.rowSpan || 1)), heights);
      const headerH = isHeaderRow(rows[0]) && units[0]?.to === 1 ? heights[0] : 0;
      return { kind: 'table', overhead: h - raw.reduce((s, x) => s + x, 0), mb, units, headerH };
    }

    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      const items = Array.from(el.children).filter((c) => c.tagName === 'LI');
      const raw = items.map(height);
      const units: Unit[] = items.map((li, j) => ({ from: j, to: j + 1, h: raw[j] - extra(li) }));
      return { kind: 'list', overhead: h - raw.reduce((s, x) => s + x, 0), mb, units };
    }

    if (node.type.name === 'paragraph') {
      const spacerH = Array.from(el.querySelectorAll('.pg-line-spacer')).reduce((s, sp) => s + extra(sp), 0);
      return {
        kind: 'block',
        h: h - spacerH + mb,
        mb,
        lines: () => measureLines(view, el as HTMLElement, positions[i], node),
      };
    }

    return { kind: 'block', h: h + mb, mb, pageBreak: node.type.name === 'pageBreak' };
  });
}

type LineBox = { top: number; bottom: number; left: number; midY: number };

// Baris-baris paragraf: tinggi (tanpa spacer dekorasi) + offset konten ProseMirror awal tiap baris.
// Mengembalikan [] bila pengukuran tidak meyakinkan (paragraf lalu dipindah utuh).
function measureLines(view: EditorView, el: HTMLElement, nodePos: number, node: PMNode): Unit[] {
  const spacers = Array.from(el.querySelectorAll<HTMLElement>('.pg-line-spacer')).map((s) => ({
    top: s.getBoundingClientRect().top,
    h: extra(s),
  }));
  // posisi vertikal tanpa tinggi spacer di atasnya
  const adjust = (y: number) => y - spacers.reduce((s, sp) => (sp.top < y ? s + sp.h : s), 0);

  const rects: DOMRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.nodeValue) continue;
      range.selectNodeContents(n);
    } else if (n.nodeName === 'BR') {
      range.selectNode(n);
    } else continue;
    rects.push(...Array.from(range.getClientRects()).filter((r) => r.height > 0));
  }
  if (rects.length === 0) return [];

  // fragmen di baris yang sama saling tumpang-tindih vertikal
  rects.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: LineBox[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && r.top < last.bottom - 1) {
      last.bottom = Math.max(last.bottom, r.bottom);
      if (r.left < last.left) {
        last.left = r.left;
        last.midY = (r.top + r.bottom) / 2;
      }
    } else {
      lines.push({ top: r.top, bottom: r.bottom, left: r.left, midY: (r.top + r.bottom) / 2 });
    }
  }

  const box = el.getBoundingClientRect();
  const contentH = box.height - spacers.reduce((s, sp) => s + sp.h, 0);
  const lead = adjust(lines[0].top) - box.top; // setengah leading baris pertama
  const starts = lines.map((l) => adjust(l.top) - box.top - lead);

  const offsets = lines.map((l, i) => {
    if (i === 0) return 0;
    const hit = view.posAtCoords({ left: l.left + 1, top: l.midY });
    return hit ? hit.pos - (nodePos + 1) : -1;
  });
  const size = node.content.size;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] <= offsets[i - 1] || offsets[i] > size) return [];
  }

  return lines.map((_, i) => ({
    from: offsets[i],
    to: i + 1 < lines.length ? offsets[i + 1] : size,
    h: (i + 1 < lines.length ? starts[i + 1] : contentH) - starts[i],
  }));
}
