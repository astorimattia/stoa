import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { docToText, htmlToEditorText, textToHtml } from './editorFormat'

// The visual editor for a piece body. It shows the piece in Stoa's own
// type, and reads and writes the same text format the server stores, so
// nothing about saving, publishing or the reader changes.

const tool = 'px-2.5 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40'
const on = ' bg-ink/10 text-ink'

function Toolbar({ editor }: { editor: Editor }) {
  const b = (active: boolean) => tool + (active ? on : '')
  const link = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('Link address (leave empty to remove the link)', prev)
    if (url === null) return
    if (!url.trim()) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    const href = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : 'https://' + url.trim()
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }
  return <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-rule bg-paper/95 py-1 font-sans backdrop-blur">
    <button type="button" title="Heading" className={b(editor.isActive('heading'))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
    <button type="button" title="Bold (Ctrl/Cmd+B)" className={b(editor.isActive('bold')) + ' font-bold'} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
    <button type="button" title="Italic (Ctrl/Cmd+I)" className={b(editor.isActive('italic')) + ' italic'} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
    <button type="button" title="Link" className={b(editor.isActive('link'))} onClick={link}>Link</button>
    <span className="mx-1 h-4 w-px bg-rule" />
    <button type="button" title="Bulleted list" className={b(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
    <button type="button" title="Numbered list" className={b(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
    <button type="button" title="Quote" className={b(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</button>
    <button type="button" title="Divider between sections (or type --- on an empty line)" className={tool} onClick={() => editor.chain().focus().setHorizontalRule().run()}>Divider</button>
    {editor.isActive('table')
      ? <>
          <button type="button" title="Add a row below" className={tool} onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button>
          <button type="button" title="Add a column to the right" className={tool} onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</button>
          <button type="button" title="Delete this row" className={tool} disabled={!editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}>− Row</button>
          <button type="button" title="Delete this column" className={tool} disabled={!editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</button>
          <button type="button" title="Delete the whole table" className={tool} onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
        </>
      : <button type="button" title="Table (the first row is the header)" className={tool} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</button>}
    <span className="mx-1 h-4 w-px bg-rule" />
    <button type="button" title="Undo (Ctrl/Cmd+Z)" className={tool} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
    <button type="button" title="Redo" className={tool} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
  </div>
}

export default function RichEditor({ value, onChange, onError }: { value: string; onChange: (body: string) => void; onError: (msg: string) => void }) {
  const last = useRef(value)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2] }, code: false, codeBlock: false, strike: false }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto'], HTMLAttributes: { rel: 'noreferrer', target: null } }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      // Only the first row is a header, to match how pieces store tables.
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Write the piece, or paste from Substack, Google Docs or the web.' }),
    ],
    content: textToHtml(value),
    editorProps: {
      attributes: { class: 'stoa-rich min-h-[420px] font-serif text-xl leading-[1.65] text-ink/90 outline-none' },
      // Pasted HTML goes through the same cleaner as before, then back to
      // simple HTML, so Docs and web styling never leaks in.
      transformPastedHTML: (html) => { const t = htmlToEditorText(html); return t ? textToHtml(t) : html },
      handlePaste: (_view, event) => {
        const d = event.clipboardData
        if (d && !d.getData('text/plain') && !d.getData('text/html') && Array.from(d.files).some((f) => f.type.startsWith('image/'))) {
          onError('Image files from your computer cannot be pasted yet. Copy the image from a web page (Substack, Docs) instead.')
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        if (Array.from(event.dataTransfer?.files || []).some((f) => f.type.startsWith('image/'))) {
          onError('Image uploads are coming in the next update. For now, copy the image from a web page.')
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => { const t = docToText(editor.getJSON() as any); last.current = t; onChange(t) },
  })
  // A new body from outside (loading a draft or a published piece).
  useEffect(() => {
    if (editor && value !== last.current) { last.current = value; editor.commands.setContent(textToHtml(value), false) }
  }, [editor, value])
  if (!editor) return null
  return <div className="mt-8">
    <Toolbar editor={editor} />
    <EditorContent editor={editor} className="mt-4" />
  </div>
}
