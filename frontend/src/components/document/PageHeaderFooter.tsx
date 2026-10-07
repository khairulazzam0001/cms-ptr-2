import { CSSProperties } from 'react';
import { PAGE_HEIGHT } from '@/lib/document/constants';
import { HF_SLOTS, HeaderFooter, formatSlot, isHeaderFooterVisible } from '@/lib/document/headerFooter';

// Header & footer satu halaman A4, di margin atas/bawah (tidak memengaruhi area konten / pagination).
// Dipakai editor (overlay per lembar, `top` = posisi lembar) dan preview (top 0).
// Teks dirender sebagai teks React (escaped), bukan HTML.
export default function PageHeaderFooter({ hf, page, pages, top = 0 }: { hf: HeaderFooter; page: number; pages: number; top?: number }) {
  if (!isHeaderFooterVisible(hf, page)) return null;
  const style: CSSProperties = { top, height: PAGE_HEIGHT };
  const row = (kind: 'header' | 'footer') => (
    <div className={`doc-hf-row doc-hf-${kind}`}>
      {HF_SLOTS.map((slot) => (
        <span key={slot}>{formatSlot(hf[`${kind}_${slot}`], page, pages)}</span>
      ))}
    </div>
  );
  return (
    <div className="doc-hf" style={style} aria-hidden>
      {row('header')}
      {row('footer')}
    </div>
  );
}
