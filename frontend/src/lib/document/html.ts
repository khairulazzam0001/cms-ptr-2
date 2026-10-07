// Konversi HTML editor <-> HTML per halaman (PRD Document Generator §5.3).
//  - split: potong HTML editor menjadi pages[] sesuai Layout; tabel lanjutan diberi data-continued
//    dan header diulang dalam <thead data-repeated>, list lanjutan diberi data-continued (+ start untuk <ol>),
//    paragraf yang dipecah per baris: potongan berikutnya <p data-continued>, potongan yang masih
//    berlanjut <p data-split>.
//  - merge: gabungkan pages[] kembali menjadi satu HTML untuk editor (tabel/list/paragraf lanjutan disatukan).
import type { Fragment } from './paginator';

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html').body;
}

function tableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows);
}

export function isHeaderRow(row: HTMLTableRowElement | undefined): boolean {
  return !!row && row.cells.length > 0 && Array.from(row.cells).every((c) => c.tagName === 'TH');
}

function listItems(list: Element): Element[] {
  return Array.from(list.children).filter((c) => c.tagName === 'LI');
}

// colgroup hanya artefak editor (lebar minimum kolom); tidak disimpan
function stripColgroup(el: Element) {
  el.querySelectorAll(':scope > colgroup').forEach((c) => c.remove());
}

// Ukuran konten inline sesuai offset ProseMirror: 1 per karakter teks, 1 per <br> (hardBreak).
function inlineSize(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').length;
  if (node.nodeName === 'BR') return 1;
  return Array.from(node.childNodes).reduce((s, c) => s + inlineSize(c), 0);
}

// Potong isi inline elemen ke rentang offset [from, to); mark (strong/span/...) di sekitarnya ikut.
export function sliceInline(el: Element, from: number, to: number): Element {
  const clone = el.cloneNode(true) as Element;
  let pos = 0;
  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      const size = inlineSize(child);
      const start = pos;
      const end = pos + size;
      pos = end;
      if (end <= from || start >= to) {
        if (!(size === 0 && start >= from && start < to)) child.remove();
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        child.nodeValue = (child.nodeValue || '').slice(Math.max(0, from - start), Math.min(size, to - start));
      } else if (child.nodeName !== 'BR') {
        pos = start;
        walk(child);
        pos = end;
      }
    }
  };
  walk(clone);
  return clone;
}

function fragmentHtml(el: Element, f: Fragment): string {
  if (f.from === undefined || f.to === undefined) {
    const clone = el.cloneNode(true) as Element;
    if (clone.tagName === 'TABLE') stripColgroup(clone);
    return clone.outerHTML;
  }
  const continued = f.from > 0;
  if (el.tagName === 'P') {
    const piece = sliceInline(el, f.from, f.to);
    if (continued) piece.setAttribute('data-continued', 'true');
    // berlanjut ke halaman berikutnya: baris terakhirnya bukan akhir paragraf (lihat CSS justify)
    if (f.to < inlineSize(el)) piece.setAttribute('data-split', 'true');
    return piece.outerHTML;
  }
  const doc = el.ownerDocument;
  const clone = el.cloneNode(false) as HTMLElement;
  if (continued) clone.setAttribute('data-continued', 'true');

  if (el.tagName === 'TABLE') {
    const rows = tableRows(el as HTMLTableElement);
    if (continued && isHeaderRow(rows[0])) {
      const thead = doc.createElement('thead');
      thead.setAttribute('data-repeated', 'true');
      thead.appendChild(rows[0].cloneNode(true));
      clone.appendChild(thead);
    }
    const tbody = doc.createElement('tbody');
    rows.slice(f.from, f.to).forEach((r) => tbody.appendChild(r.cloneNode(true)));
    clone.appendChild(tbody);
  } else {
    if (continued && el.tagName === 'OL') {
      const start = parseInt(el.getAttribute('start') || '1', 10) || 1;
      clone.setAttribute('start', String(start + f.from));
    }
    listItems(el).slice(f.from, f.to).forEach((li) => clone.appendChild(li.cloneNode(true)));
  }
  return clone.outerHTML;
}

// Jumlah elemen level atas HTML editor = jumlah node level atas dokumen ProseMirror.
export function topLevelElements(html: string): Element[] {
  return Array.from(parseBody(html).children);
}

export function splitIntoPages(html: string, pages: Fragment[][]): string[] {
  const els = topLevelElements(html);
  return pages.map((frags) => frags.map((f) => fragmentHtml(els[f.index], f)).join(''));
}

export function mergePages(pages: string[]): string {
  const body = parseBody(pages.join(''));
  body.querySelectorAll(':scope > p[data-split]').forEach((p) => p.removeAttribute('data-split'));
  for (const el of Array.from(body.children)) {
    if (!el.hasAttribute('data-continued')) continue;
    const prev = el.previousElementSibling;
    if (!prev || prev.tagName !== el.tagName) {
      el.removeAttribute('data-continued');
      continue;
    }
    if (el.tagName === 'P') {
      // paragraf lanjutan: isi disambung ke paragraf sebelumnya (mark sejenis digabung ProseMirror)
      Array.from(el.childNodes).forEach((c) => prev.appendChild(c));
    } else if (el.tagName === 'TABLE') {
      el.querySelectorAll(':scope > thead[data-repeated]').forEach((t) => t.remove());
      const target = prev as HTMLTableElement;
      const tbody = target.tBodies[target.tBodies.length - 1] ?? target.appendChild(body.ownerDocument.createElement('tbody'));
      tableRows(el as HTMLTableElement).forEach((r) => tbody.appendChild(r));
    } else {
      listItems(el).forEach((li) => prev.appendChild(li));
    }
    el.remove();
  }
  return body.innerHTML;
}
