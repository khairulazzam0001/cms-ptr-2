// Ekstensi TipTap untuk Document Generator: page break manual, indent, tabel dengan border on/off.
import { CommandProps, Extension, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { Table, TableView } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: { setPageBreak: () => ReturnType };
    indent: { indent: () => ReturnType; outdent: () => ReturnType };
  }
}

// <div data-page-break="true"></div>: konten setelahnya selalu mulai di halaman baru (FR-25)
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true' })],
  addCommands() {
    return { setPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }) };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});

// Indent paragraf/heading via padding-left; di dalam list = sink/lift item (FR-34)
const INDENT_PX = 24;
const MAX_INDENT = 8;
const INDENT_TYPES = ['paragraph', 'heading'];

export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Math.round((parseFloat(el.style.paddingLeft) || 0) / INDENT_PX)),
            renderHTML: (attrs) => (attrs.indent ? { style: `padding-left: ${attrs.indent * INDENT_PX}px` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    // tr ikut di-dispatch oleh CommandManager; di sini cukup diubah bila dispatch tersedia
    const shift = (delta: number) => () => ({ editor, tr, state, dispatch, commands }: CommandProps) => {
      if (editor.isActive('listItem')) {
        return delta > 0 ? commands.sinkListItem('listItem') : commands.liftListItem('listItem');
      }
      let changed = false;
      state.doc.nodesBetween(state.selection.from, state.selection.to, (node: PMNode, pos: number) => {
        if (!INDENT_TYPES.includes(node.type.name)) return true;
        const next = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent || 0) + delta));
        if (next !== node.attrs.indent) {
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        }
        return false;
      });
      return changed;
    };
    return { indent: shift(1), outdent: shift(-1) };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => (this.editor.isActive('table') ? false : this.editor.commands.indent()),
      'Shift-Tab': () => (this.editor.isActive('table') ? false : this.editor.commands.outdent()),
    };
  },
});

// TableView bawaan tidak memperbarui atribut <table> saat node berubah; sinkronkan data-borderless
class DocTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number, view?: EditorView, attrs?: Record<string, unknown>) {
    super(node, cellMinWidth, view, attrs);
    this.syncBorder(node);
  }
  update(node: PMNode) {
    const ok = super.update(node);
    if (ok) this.syncBorder(node);
    return ok;
  }
  private syncBorder(node: PMNode) {
    if (node.attrs.borderless) this.table.setAttribute('data-borderless', 'true');
    else this.table.removeAttribute('data-borderless');
  }
}

export const DocTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borderless: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-borderless') === 'true',
        renderHTML: (attrs: Record<string, unknown>) => (attrs.borderless ? { 'data-borderless': 'true' } : {}),
      },
    };
  },
}).configure({ resizable: false, View: DocTableView });
