// Tampilan halaman A4 di editor: dekorasi ProseMirror di posisi break dari paginator,
// tanpa mengubah dokumen (satu instance editor untuk seluruh dokumen).
//  - break sebelum blok      -> widget .pg-spacer (sisa halaman + margin bawah + jarak + margin atas)
//  - break di tengah tabel/list -> node decoration .pg-split pada baris/item (padding-top setinggi spacer)
//  - break di tengah paragraf -> widget inline span.pg-line-spacer (display:block) di awal baris
//  - blok/baris melebihi 1 halaman -> .pg-overflow + peringatan (FR-26)
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { PAGE_GAP, PAGE_MARGIN } from '@/lib/document/constants';
import type { Layout } from '@/lib/document/paginator';

export const paginationKey = new PluginKey<DecorationSet>('docPagination');

export const Pagination = Extension.create({
  name: 'docPagination',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => (tr.getMeta(paginationKey) as DecorationSet | undefined) ?? set.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => paginationKey.getState(state) },
      }),
    ];
  },
});

// inline = di tengah paragraf (span display:block memutus baris tepat di awal baris berikutnya)
function spacer(total: number, barTop: number, pageNo: number, inline = false) {
  const el = document.createElement(inline ? 'span' : 'div');
  el.className = inline ? 'pg-spacer pg-line-spacer' : 'pg-spacer';
  el.dataset.pbExtra = String(total);
  el.contentEditable = 'false';
  el.style.height = `${total}px`;
  el.style.setProperty('--pg-a', `${barTop}px`);
  el.dataset.page = String(pageNo);
  return el;
}

function childPos(parent: PMNode, parentPos: number, index: number) {
  let pos = parentPos + 1;
  for (let i = 0; i < index; i++) pos += parent.child(i).nodeSize;
  return pos;
}

export function buildDecorations(doc: PMNode, layout: Layout): DecorationSet {
  const offsets: number[] = [];
  doc.forEach((_, offset) => offsets.push(offset));
  const decos: Decoration[] = [];

  layout.starts.forEach((s, i) => {
    const pageNo = i + 2;
    const total = Math.max(0, s.remaining + 2 * PAGE_MARGIN + PAGE_GAP + (s.reserve ?? 0));
    const barTop = Math.max(0, s.remaining + PAGE_MARGIN);
    const pos = offsets[s.index];
    const node = doc.child(s.index);
    if (s.sub !== undefined && node.type.name === 'paragraph') {
      // paragraf dipecah per baris: sub = offset konten awal baris
      decos.push(
        Decoration.widget(pos + 1 + s.sub, () => spacer(total, barTop, pageNo, true), {
          side: -1,
          ignoreSelection: true,
          key: `pgl-${s.index}-${s.sub}-${pageNo}-${Math.round(total)}`,
        }),
      );
      return;
    }
    if (s.sub === undefined) {
      decos.push(
        Decoration.widget(pos, () => spacer(total, barTop, pageNo), {
          side: -1,
          ignoreSelection: true,
          key: `pg-${s.index}-${pageNo}-${Math.round(total)}`,
        }),
      );
      return;
    }
    const from = childPos(node, pos, s.sub);
    decos.push(
      Decoration.node(from, from + node.child(s.sub).nodeSize, {
        class: 'pg-split',
        style: `--pg-t: ${total}px; --pg-a: ${barTop}px`,
        'data-pb-extra': String(total),
        'data-page': String(pageNo),
        ...(s.reserve ? { 'data-reserve': String(s.reserve) } : {}),
      }),
    );
  });

  layout.overflow.forEach((o) => {
    const pos = offsets[o.index];
    const node = doc.child(o.index);
    const whole = o.sub === undefined || node.type.name === 'paragraph';
    const from = whole ? pos : childPos(node, pos, o.sub!);
    const size = whole ? node.nodeSize : node.child(o.sub!).nodeSize;
    decos.push(Decoration.node(from, from + size, { class: 'pg-overflow' }));
  });

  return DecorationSet.create(doc, decos);
}
