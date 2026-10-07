// Pembersihan HTML paste dari Word / Google Docs (PRD Document Generator §6.5).
// Dipertahankan: heading, B/I/U/S, list, alignment, warna, ukuran font (dibulatkan ke FONT_SIZES_PT),
// tabel + merge cell. Dibuang: class/mso-*, font family, background, gambar, komentar, field Word.
import { FONT_SIZES_PT } from './constants';

const DROP_TAGS = 'script,style,meta,link,title,img,svg,picture,video,audio,iframe,object,embed,xml';
const KEEP_ATTRS = ['style', 'colspan', 'rowspan', 'start'];
const KEEP_STYLES = ['color', 'font-size', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'vertical-align'];
const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH'];

export function nearestFontSize(value: string): string | null {
  const m = /^([\d.]+)\s*(pt|px)$/i.exec(value.trim());
  if (!m) return null;
  const pt = m[2].toLowerCase() === 'px' ? parseFloat(m[1]) * 0.75 : parseFloat(m[1]);
  if (!isFinite(pt) || pt <= 0) return null;
  const best = FONT_SIZES_PT.reduce((a, b) => (Math.abs(b - pt) < Math.abs(a - pt) ? b : a));
  return `${best}pt`;
}

function cleanStyle(el: HTMLElement) {
  const kept: string[] = [];
  for (const decl of (el.getAttribute('style') || '').split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    let value = decl.slice(i + 1).trim();
    if (!KEEP_STYLES.includes(prop) || /url\(|expression/i.test(value)) continue;
    if (prop === 'font-size') {
      const size = nearestFontSize(value);
      if (!size) continue;
      value = size;
    }
    kept.push(`${prop}: ${value}`);
  }
  if (kept.length) el.setAttribute('style', kept.join('; '));
  else el.removeAttribute('style');
}

// Word: item list adalah <p class="MsoListParagraph..."> dengan penanda "1." / "·" di <span style="mso-list:Ignore">.
function convertWordLists(body: HTMLElement) {
  const doc = body.ownerDocument;
  const isListPara = (el: Element | null): el is HTMLElement =>
    !!el && el.tagName === 'P' && (/MsoListParagraph/i.test(el.className) || /mso-list\s*:/i.test(el.getAttribute('style') || ''));

  for (const el of Array.from(body.querySelectorAll('p'))) {
    if (!isListPara(el) || !el.isConnected) continue;
    if (isListPara(el.previousElementSibling)) continue; // bukan awal grup

    const group: HTMLElement[] = [];
    for (let cur: Element | null = el; isListPara(cur); cur = cur.nextElementSibling) group.push(cur);

    const marker = (p: HTMLElement) => {
      const ign = Array.from(p.querySelectorAll('span')).find((s) => /mso-list\s*:\s*ignore/i.test(s.getAttribute('style') || ''));
      const text = (ign?.textContent || '').trim();
      ign?.remove();
      return text;
    };
    const markers = group.map(marker);
    const ordered = /^(\d+|[a-z]|[ivxlc]+)[.)]$/i.test(markers[0]);
    const list = doc.createElement(ordered ? 'ol' : 'ul');
    el.before(list);
    for (const p of group) {
      const li = doc.createElement('li');
      const para = doc.createElement('p');
      para.innerHTML = p.innerHTML;
      const align = p.style.textAlign;
      if (align) para.style.textAlign = align;
      li.appendChild(para);
      list.appendChild(li);
      p.remove();
    }
  }
}

// Ukuran font/warna di level blok dipindah ke <span> (TipTap menyimpannya sebagai mark textStyle)
function liftBlockTextStyle(el: HTMLElement) {
  const color = el.style.color;
  const size = el.style.fontSize;
  if (!color && !size) return;
  el.style.removeProperty('color');
  el.style.removeProperty('font-size');
  if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  const span = el.ownerDocument.createElement('span');
  if (color) span.style.color = color;
  if (size) span.style.fontSize = size;
  while (el.firstChild) span.appendChild(el.firstChild);
  el.appendChild(span);
}

export function normalizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // komentar HTML (termasuk conditional comment Word)
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  body.querySelectorAll(DROP_TAGS).forEach((el) => el.remove());
  convertWordLists(body);

  for (const el of Array.from(body.querySelectorAll<HTMLElement>('*'))) {
    // tag namespace Word (o:p, w:sdt, ...) -> buka isinya
    if (el.tagName.includes(':')) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRS.includes(attr.name)) el.removeAttribute(attr.name);
    }
    cleanStyle(el);
    if (BLOCK_TAGS.includes(el.tagName)) liftBlockTextStyle(el);
  }
  return body.innerHTML;
}
