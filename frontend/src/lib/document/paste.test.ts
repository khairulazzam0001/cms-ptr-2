import { describe, expect, it } from 'vitest';
import { nearestFontSize, normalizePastedHtml } from './paste';

describe('nearestFontSize', () => {
  it('membulatkan ke ukuran yang tersedia', () => {
    expect(nearestFontSize('13pt')).toBe('12pt');
    expect(nearestFontSize('16px')).toBe('12pt');
    expect(nearestFontSize('40pt')).toBe('36pt');
    expect(nearestFontSize('large')).toBeNull();
  });
});

describe('normalizePastedHtml (AC-11)', () => {
  it('membuang class mso-*, font-family, background, komentar, gambar, dan tag o:p', () => {
    const word =
      '<!--[if gte mso 9]><xml>x</xml><![endif]--><p class="MsoNormal" style="mso-line-height-alt:1pt;font-family:Calibri;background:yellow;text-align:center">' +
      '<b>Tebal</b><o:p></o:p><img src="x.png"></p>';
    expect(normalizePastedHtml(word)).toBe('<p style="text-align: center"><b>Tebal</b></p>');
  });

  it('ukuran font & warna di paragraf dipindah ke span', () => {
    expect(normalizePastedHtml('<p style="font-size:13.0pt;color:red">A</p>')).toBe(
      '<p><span style="color: red; font-size: 12pt;">A</span></p>',
    );
  });

  it('paragraf list Word menjadi <ol>/<ul>', () => {
    const html =
      '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1.<span> </span></span>Satu</p>' +
      '<p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2.<span> </span></span>Dua</p>' +
      '<p class="MsoListParagraph" style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">·</span>Poin</p>';
    expect(normalizePastedHtml(html)).toBe('<ol><li><p>Satu</p></li><li><p>Dua</p></li><li><p>Poin</p></li></ol>');
  });

  it('mempertahankan tabel dengan merge cell', () => {
    expect(normalizePastedHtml('<table class="MsoTable"><tr><td colspan="2" width="100">a</td></tr></table>')).toBe(
      '<table><tbody><tr><td colspan="2">a</td></tr></tbody></table>',
    );
  });
});
