'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { CONTENT_HEIGHT, PAGE_GAP, PAGE_HEIGHT, PAGE_MARGIN, PAGINATE_DEBOUNCE_MS } from '@/lib/document/constants';
import type { HeaderFooter } from '@/lib/document/headerFooter';
import { splitIntoPages, topLevelElements } from '@/lib/document/html';
import { measureBlocks } from '@/lib/document/measure';
import { Layout, paginate } from '@/lib/document/paginator';
import { normalizePastedHtml } from '@/lib/document/paste';
import { DocTable, Indent, PageBreak } from './extensions';
import { Pagination, buildDecorations, paginationKey } from './pagination';
import PageHeaderFooter from './PageHeaderFooter';
import Toolbar from './Toolbar';

export type DocumentEditorHandle = {
  // Hitung ulang pagination dan kembalikan HTML per halaman (payload simpan, FR-28)
  getPages: () => string[] | null;
};

type Props = {
  initialHtml: string;
  headerFooter: HeaderFooter;
  onChange: () => void;
  onSaveShortcut: () => void;
};

const DocumentEditor = forwardRef<DocumentEditorHandle, Props>(function DocumentEditor(
  { initialHtml, headerFooter, onChange, onSaveShortcut },
  ref,
) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // format di luar FR-30..36 dimatikan (FR-37)
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      DocTable,
      TableRow,
      TableHeader,
      TableCell,
      PageBreak,
      Indent,
      Pagination,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: 'doc-content', 'aria-label': 'Isi dokumen' },
      transformPastedHTML: normalizePastedHtml,
    },
    onUpdate: () => onChangeRef.current(),
  });

  const relayout = useCallback((ed: Editor): Layout | null => {
    if (ed.isDestroyed) return null;
    const blocks = measureBlocks(ed.view);
    if (!blocks) return null;
    const next = paginate(blocks, CONTENT_HEIGHT);
    ed.view.dispatch(
      ed.state.tr.setMeta(paginationKey, buildDecorations(ed.state.doc, next)).setMeta('addToHistory', false),
    );
    setLayout(next);
    return next;
  }, []);

  // Pagination ulang setiap perubahan konten (debounce, FR-27) dan saat dokumen dibuka
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => relayout(editor), PAGINATE_DEBOUNCE_MS);
    };
    editor.on('update', schedule);
    const frame = requestAnimationFrame(() => relayout(editor));
    // font harus sudah dimuat agar tinggi blok akurat
    document.fonts?.ready.then(() => relayout(editor));
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      editor.off('update', schedule);
    };
  }, [editor, relayout]);

  useImperativeHandle(
    ref,
    () => ({
      getPages: () => {
        if (!editor) return null;
        const current = relayout(editor);
        const html = editor.getHTML();
        if (!current || topLevelElements(html).length !== editor.state.doc.childCount) return null;
        return splitIntoPages(html, current.pages);
      },
    }),
    [editor, relayout],
  );

  if (!editor) return <div className="p-6 text-slate-500">Memuat editor…</div>;

  const lastFill = layout ? Math.max(0, CONTENT_HEIGHT - layout.lastUsed) : 0;
  const overflowCount = layout?.overflow.length ?? 0;

  return (
    <div
      className="flex flex-col min-h-0 flex-1"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut();
        }
      }}
    >
      <Toolbar editor={editor} />
      {overflowCount > 0 && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 border-b" role="alert">
          {overflowCount} blok melebihi 1 halaman (ditandai garis merah) — pecah paragraf/baris tersebut.
        </div>
      )}
      <div className="doc-canvas flex-1">
        <div className="doc-sheet" style={{ paddingBottom: PAGE_MARGIN + lastFill }}>
          <EditorContent editor={editor} />
          {/* header/footer tiap lembar di margin; posisi lembar = i x (tinggi A4 + jarak) */}
          {layout?.pages.map((_, i) => (
            <PageHeaderFooter key={i} hf={headerFooter} page={i + 1} pages={layout.pages.length} top={i * (PAGE_HEIGHT + PAGE_GAP)} />
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">{layout ? `${layout.pages.length} halaman` : ''}</p>
      </div>
    </div>
  );
});

export default DocumentEditor;
