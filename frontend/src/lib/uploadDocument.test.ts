import { describe, expect, it } from 'vitest';
import { PREVIEW_CSP, buildPreviewSrcdoc, checkHtmlFile, formatBytes } from './uploadDocument';

describe('buildPreviewSrcdoc', () => {
  it('menyisipkan CSP + base di awal head, doctype dipertahankan, isi tetap', () => {
    const out = buildPreviewSrcdoc('<!doctype html><html><head><style>p{color:red}</style></head><body><p>Halo</p></body></html>');
    expect(out.startsWith('<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(out).toContain(`content="${PREVIEW_CSP}"`);
    expect(out).toContain('<base target="_blank"><style>p{color:red}</style>');
    expect(out).toContain('<p>Halo</p>');
  });

  it('membuang meta refresh, CSP asli, dan base asli', () => {
    const out = buildPreviewSrcdoc(
      '<html><head><meta http-equiv="refresh" content="0;url=https://evil.example"><meta http-equiv="Content-Security-Policy" content="default-src *"><base href="https://evil.example/"></head><body>x</body></html>',
    );
    expect(out).not.toContain('refresh');
    expect(out).not.toContain('default-src *');
    expect(out).not.toContain('evil.example');
    expect(out.match(/<base /g)).toHaveLength(1);
  });

  it('fragmen tanpa html/head tetap mendapat CSP', () => {
    const out = buildPreviewSrcdoc('<p>fragmen</p>');
    expect(out).toMatch(/^<html><head><meta http-equiv="Content-Security-Policy"/);
    expect(out).toContain('<body><p>fragmen</p></body>');
  });

  it('script tetap ada sebagai teks (tidak dijalankan: iframe sandbox tanpa allow-scripts)', () => {
    expect(buildPreviewSrcdoc('<p>a</p><script>alert(1)</script>')).toContain('<script>alert(1)</script>');
  });
});

describe('checkHtmlFile', () => {
  const f = (name: string, size: number) => new File([new Uint8Array(size)], name);
  it('validasi ekstensi dan ukuran', () => {
    expect(checkHtmlFile(f('a.html', 10))).toBeNull();
    expect(checkHtmlFile(f('A.HTM', 10))).toBeNull();
    expect(checkHtmlFile(f('a.pdf', 10))).toBe('File harus berekstensi .html atau .htm');
    expect(checkHtmlFile(f('a.html', 0))).toBe('File kosong');
    expect(checkHtmlFile(f('a.html', 2 * 1024 * 1024 + 1))).toBe('Ukuran file maksimal 2 MB');
  });
});

describe('formatBytes', () => {
  it('B / KB / MB', () => {
    expect(formatBytes(17)).toBe('17 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});
