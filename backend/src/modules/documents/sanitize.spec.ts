import { isEmptyDocumentHtml, sanitizeDocumentHtml } from './sanitize';

describe('sanitizeDocumentHtml', () => {
  it('membuang script, event handler, dan javascript: (AC-12)', () => {
    const out = sanitizeDocumentHtml(
      '<p onclick="alert(1)">Halo<script>alert(2)</script></p><a href="javascript:alert(3)">x</a><img src=x onerror=alert(4)>',
    );
    expect(out).toBe('<p>Halo</p>x');
  });

  it('membuang style, iframe beserta isinya, class mso-*, dan komentar', () => {
    const out = sanitizeDocumentHtml(
      '<style>p{color:red}</style><iframe>bad</iframe><p class="MsoNormal"><!-- c -->Teks</p>',
    );
    expect(out).toBe('<p>Teks</p>');
  });

  it('mempertahankan style yang diizinkan dan membuang sisanya', () => {
    const out = sanitizeDocumentHtml(
      '<p style="text-align:center;font-family:Calibri;padding-left:48px"><span style="color:#ff0000;font-size:14pt;background:url(x)">A</span></p>',
    );
    expect(out).toBe('<p style="text-align:center;padding-left:48px"><span style="color:#ff0000;font-size:14pt">A</span></p>');
  });

  it('membuang nilai style berbahaya', () => {
    const out = sanitizeDocumentHtml('<table style="border:1px solid url(javascript:x);width:100%"><tbody><tr><td>a</td></tr></tbody></table>');
    expect(out).toBe('<table style="width:100%"><tbody><tr><td>a</td></tr></tbody></table>');
  });

  it('mempertahankan marker halaman, tabel lanjutan, dan merge cell', () => {
    const html =
      '<table data-continued="true"><thead data-repeated="true"><tr><th colspan="2">H</th></tr></thead>' +
      '<tbody><tr><td rowspan="2">a</td></tr></tbody></table><div data-page-break="true"></div>';
    expect(sanitizeDocumentHtml(html)).toBe(html);
  });

  it('paragraf lanjutan (dipecah per baris) mempertahankan data-continued', () => {
    const html = '<p style="text-align:justify" data-continued="true" data-split="true">lanjutan</p>';
    expect(sanitizeDocumentHtml(html)).toBe(html);
  });

  it('marker hanya menerima nilai "true"', () => {
    expect(sanitizeDocumentHtml('<div data-page-break="x" data-foo="1"></div>')).toBe('<div></div>');
  });

  it('atribut start pada ol hanya angka', () => {
    expect(sanitizeDocumentHtml('<ol start="3"><li>a</li></ol>')).toBe('<ol start="3"><li>a</li></ol>');
    expect(sanitizeDocumentHtml('<ol start="x"><li>a</li></ol>')).toBe('<ol><li>a</li></ol>');
  });
});

describe('isEmptyDocumentHtml', () => {
  it('kosong bila hanya tag tanpa teks', () => {
    expect(isEmptyDocumentHtml('<p></p><p>&nbsp;</p><div data-page-break="true"></div>')).toBe(true);
  });
  it('tidak kosong bila ada teks atau tabel', () => {
    expect(isEmptyDocumentHtml('<p>a</p>')).toBe(false);
    expect(isEmptyDocumentHtml('<table><tbody><tr><td></td></tr></tbody></table>')).toBe(false);
  });
});
