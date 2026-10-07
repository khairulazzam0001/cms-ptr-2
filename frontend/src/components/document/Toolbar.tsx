'use client';
import { useState } from 'react';
import { Editor, useEditorState } from '@tiptap/react';
import { FONT_SIZES_PT, MAX_TABLE_COLS, MAX_TABLE_ROWS, TEXT_COLORS } from '@/lib/document/constants';

type BtnProps = {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
};

function Btn({ label, onClick, active, disabled, children }: BtnProps) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' tb-active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // jangan ambil fokus dari editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px self-stretch bg-slate-300 mx-1" aria-hidden />;
const ALIGNS = [
  { value: 'left', label: 'Rata kiri', icon: '⯇' },
  { value: 'center', label: 'Rata tengah', icon: '≡' },
  { value: 'right', label: 'Rata kanan', icon: '⯈' },
  { value: 'justify', label: 'Rata kiri-kanan', icon: '☰' },
] as const;

export default function Toolbar({ editor }: { editor: Editor }) {
  const [showColors, setShowColors] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeader, setWithHeader] = useState(true);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level }))?.toString() ?? 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      color: (e.getAttributes('textStyle').color as string | undefined) ?? '',
      align: ALIGNS.find((a) => e.isActive({ textAlign: a.value }))?.value ?? 'left',
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      inTable: e.isActive('table'),
      borderless: !!e.getAttributes('table').borderless,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      canMergeOrSplit: e.can().mergeOrSplit(),
    }),
  });

  const chain = () => editor.chain().focus();

  function setBlock(value: string) {
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
  }

  function insertTable() {
    const r = Math.min(MAX_TABLE_ROWS, Math.max(1, rows));
    const c = Math.min(MAX_TABLE_COLS, Math.max(1, cols));
    chain().insertTable({ rows: r, cols: c, withHeaderRow: withHeader }).run();
    setShowTable(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-white border-b sticky top-0 z-20" role="toolbar" aria-label="Format dokumen">
      <Btn label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!s.canUndo}>↶</Btn>
      <Btn label="Redo (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!s.canRedo}>↷</Btn>
      <Sep />
      <select className="tb-select" aria-label="Jenis paragraf" value={s.block} onChange={(e) => setBlock(e.target.value)}>
        <option value="p">Paragraf</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      <select
        className="tb-select"
        aria-label="Ukuran font"
        value={s.fontSize}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
      >
        <option value="">11 (default)</option>
        {FONT_SIZES_PT.map((pt) => (
          <option key={pt} value={`${pt}pt`}>{pt}</option>
        ))}
      </select>
      <Sep />
      <Btn label="Tebal (Ctrl+B)" onClick={() => chain().toggleBold().run()} active={s.bold}><b>B</b></Btn>
      <Btn label="Miring (Ctrl+I)" onClick={() => chain().toggleItalic().run()} active={s.italic}><i>I</i></Btn>
      <Btn label="Garis bawah (Ctrl+U)" onClick={() => chain().toggleUnderline().run()} active={s.underline}><u>U</u></Btn>
      <Btn label="Coret" onClick={() => chain().toggleStrike().run()} active={s.strike}><s>S</s></Btn>
      <div className="relative">
        <Btn label="Warna teks" onClick={() => setShowColors((v) => !v)} active={showColors}>
          <span className="font-bold" style={{ color: s.color || '#000', borderBottom: `3px solid ${s.color || '#000'}` }}>A</span>
        </Btn>
        {showColors && (
          <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow p-2 z-30 w-44">
            <div className="grid grid-cols-6 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Warna ${c}`}
                  className="w-6 h-6 rounded border"
                  style={{ background: c }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { chain().setColor(c).run(); setShowColors(false); }}
                />
              ))}
            </div>
            <button
              type="button"
              className="tb-btn w-full mt-2"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { chain().unsetColor().run(); setShowColors(false); }}
            >
              Reset warna
            </button>
          </div>
        )}
      </div>
      <Sep />
      {ALIGNS.map((a) => (
        <Btn key={a.value} label={a.label} onClick={() => chain().setTextAlign(a.value).run()} active={s.align === a.value}>
          {a.icon}
        </Btn>
      ))}
      <Sep />
      <Btn label="Bullet list" onClick={() => chain().toggleBulletList().run()} active={s.bullet}>•≡</Btn>
      <Btn label="Numbered list" onClick={() => chain().toggleOrderedList().run()} active={s.ordered}>1≡</Btn>
      <Btn label="Kurangi indent (Shift+Tab)" onClick={() => chain().outdent().run()}>⇤</Btn>
      <Btn label="Tambah indent (Tab)" onClick={() => chain().indent().run()}>⇥</Btn>
      <Sep />
      <div className="relative">
        <Btn label="Sisipkan tabel" onClick={() => setShowTable((v) => !v)} active={showTable}>▦ Tabel</Btn>
        {showTable && (
          <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow p-3 z-30 w-56 space-y-2 text-sm">
            <label className="flex items-center justify-between gap-2">Baris (maks {MAX_TABLE_ROWS})
              <input type="number" className="input !w-16 !py-1" min={1} max={MAX_TABLE_ROWS} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
            </label>
            <label className="flex items-center justify-between gap-2">Kolom (maks {MAX_TABLE_COLS})
              <input type="number" className="input !w-16 !py-1" min={1} max={MAX_TABLE_COLS} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withHeader} onChange={(e) => setWithHeader(e.target.checked)} /> Baris header
            </label>
            <button type="button" className="btn-dark w-full !py-1" onClick={insertTable}>Sisipkan</button>
          </div>
        )}
      </div>
      {s.inTable && (
        <>
          <Btn label="Tambah baris di bawah" onClick={() => chain().addRowAfter().run()}>+Baris</Btn>
          <Btn label="Hapus baris" onClick={() => chain().deleteRow().run()}>−Baris</Btn>
          <Btn label="Tambah kolom di kanan" onClick={() => chain().addColumnAfter().run()}>+Kolom</Btn>
          <Btn label="Hapus kolom" onClick={() => chain().deleteColumn().run()}>−Kolom</Btn>
          <Btn label="Gabung / pisah sel" onClick={() => chain().mergeOrSplit().run()} disabled={!s.canMergeOrSplit}>⊞</Btn>
          <Btn label="Baris header on/off" onClick={() => chain().toggleHeaderRow().run()}>Header</Btn>
          <Btn label="Border on/off" onClick={() => chain().updateAttributes('table', { borderless: !s.borderless }).run()} active={!s.borderless}>
            Border
          </Btn>
          <Btn label="Hapus tabel" onClick={() => chain().deleteTable().run()}>🗑 Tabel</Btn>
        </>
      )}
      <Sep />
      <Btn label="Page break (Ctrl+Enter)" onClick={() => chain().setPageBreak().run()}>⤓ Page break</Btn>
    </div>
  );
}
