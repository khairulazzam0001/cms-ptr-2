import sanitizeHtml from 'sanitize-html';

// Allowlist HTML dokumen (PRD Document Generator §8). Semua yang tidak terdaftar dibuang:
// script/style/iframe, event handler on*, href/src, class, komentar.
const TEXT_TAGS = ['p', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'br', 'span', 'li', 'ul', 'tr', 'tbody'];

// Nilai CSS: angka + satuan sederhana. Tidak ada url( / expression( / javascript:.
const SIZE = /^\d+(\.\d+)?(pt|px)$/;
const LENGTH = /^\d+(\.\d+)?(px|%)$/;
const SAFE_BORDER = /^(?!.*(url|expression|javascript))[a-z0-9#.,()\s%-]+$/i;
const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i];

const STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
  '*': {
    color: COLOR,
    'font-size': [SIZE],
    'text-align': [/^(left|right|center|justify)$/],
    'padding-left': [/^\d+(\.\d+)?px$/],
    width: [LENGTH],
    border: [SAFE_BORDER],
    'border-collapse': [/^(collapse|separate)$/],
    'vertical-align': [/^(top|middle|bottom|baseline)$/],
  },
};

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...TEXT_TAGS, 'ol', 'table', 'thead', 'th', 'td', 'div'],
  allowedAttributes: {
    ...Object.fromEntries(TEXT_TAGS.map((t) => [t, ['style']])),
    // paragraf dipecah per baris: data-continued = potongan lanjutan, data-split = masih berlanjut
    p: ['style', 'data-continued', 'data-split'],
    // start: penomoran list berlanjut di halaman berikutnya (FR-24)
    ol: ['style', 'start', 'data-continued'],
    ul: ['style', 'data-continued'],
    th: ['style', 'colspan', 'rowspan'],
    td: ['style', 'colspan', 'rowspan'],
    table: ['style', 'data-continued', 'data-borderless'],
    thead: ['data-repeated'],
    div: ['data-page-break'],
  },
  allowedStyles: STYLES,
  allowedSchemes: [],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Isi tag berbahaya dibuang seluruhnya, bukan hanya tag-nya
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'title', 'head'],
  // Validasi nilai atribut: marker hanya "true", start/colspan/rowspan hanya angka.
  // (opsi `values` sanitize-html tetap menyisakan atribut kosong, jadi dibuang di sini)
  transformTags: {
    '*': (tagName, attribs) => ({
      tagName,
      attribs: Object.fromEntries(Object.entries(attribs).filter(([name, value]) => isValidAttr(name, value))),
    }),
  },
};

const MARKERS = ['data-continued', 'data-split', 'data-borderless', 'data-repeated', 'data-page-break'];
const NUMERIC = ['start', 'colspan', 'rowspan'];

function isValidAttr(name: string, value: string): boolean {
  if (MARKERS.includes(name)) return value === 'true';
  if (NUMERIC.includes(name)) return /^\d{1,4}$/.test(value);
  return true;
}

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

// Dokumen dianggap kosong bila tidak ada teks maupun tabel (FR-55).
export function isEmptyDocumentHtml(html: string): boolean {
  if (/<table[\s>]/i.test(html)) return false;
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|&#160;/g, ' ')
    .trim();
  return text.length === 0;
}
