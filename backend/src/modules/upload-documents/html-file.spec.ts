import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MAX_HTML_BYTES, htmlWarnings, readHtmlFile } from './html-file';

const file = (content: string | Buffer, originalname = 'a.html') => {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return { originalname, size: buffer.length, buffer };
};

describe('readHtmlFile (FR-UD-11)', () => {
  it('mengembalikan isi utuh (termasuk head/style/script), BOM dibuang', () => {
    const html = '<!doctype html><html><head><style>p{color:red}</style></head><body><p>Halo ü</p><script>x()</script></body></html>';
    expect(readHtmlFile(file(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(html, 'utf8')])))).toBe(html);
  });

  it('menerima .htm dan ekstensi huruf besar', () => {
    expect(readHtmlFile(file('<p>a</p>', 'LAPORAN.HTM'))).toBe('<p>a</p>');
  });

  it.each([
    ['tanpa file', undefined, 'File wajib diisi'],
    ['ekstensi lain', file('<p>a</p>', 'a.pdf'), 'File harus berekstensi .html atau .htm'],
    ['file kosong', file(''), 'File kosong'],
    ['hanya spasi', file('   \n'), 'File kosong'],
    ['bukan UTF-8', file(Buffer.from([0x3c, 0x70, 0x3e, 0xff, 0xfe])), 'File harus berupa teks UTF-8'],
    ['byte NUL', file('<p>a\u0000</p>'), 'File harus berupa teks UTF-8'],
    ['tanpa tag HTML', file('teks biasa'), 'File tidak berisi tag HTML'],
  ])('400: %s', (_name, input, message) => {
    expect(() => readHtmlFile(input)).toThrow(new BadRequestException(message));
  });

  it('413 bila lebih dari 2 MB', () => {
    const big = { originalname: 'a.html', size: MAX_HTML_BYTES + 1, buffer: Buffer.alloc(0) };
    expect(() => readHtmlFile(big)).toThrow(PayloadTooLargeException);
  });
});

describe('htmlWarnings (FR-UD-13)', () => {
  it('mendeteksi script dan event handler', () => {
    expect(htmlWarnings('<script>a()</script>')).toHaveLength(1);
    expect(htmlWarnings('<body onload="x()">')).toHaveLength(1);
  });
  it('mendeteksi resource eksternal', () => {
    expect(htmlWarnings('<img src="https://x.com/a.png">')).toHaveLength(1);
    expect(htmlWarnings('<link href="//cdn.x/a.css">')).toHaveLength(1);
    expect(htmlWarnings('<style>@import "https://x/a.css";</style>')).toHaveLength(1);
    expect(htmlWarnings('<div style="background:url(http://x/a.png)">')).toHaveLength(1);
  });
  it('tidak ada peringatan untuk CSS inline dan gambar data:', () => {
    expect(htmlWarnings('<style>p{color:red}</style><img src="data:image/png;base64,AAAA"><a href="#x">x</a>')).toEqual([]);
  });
});
