'use client';

/**
 * RICH TEXT EDITOR (Tiptap) — DEVELOPER-MANUAL §6.6
 * Headings, bold/italic/underline/strike, font family & size, colour +
 * highlight, lists, align, links, images, tables, YouTube, blockquote, hr,
 * undo/redo, clear-format. Word-paste formatting preserved by Tiptap core.
 */

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontSize, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link2, ImagePlus, Table as TableIcon,
  Quote, Minus, Undo2, Redo2, RemoveFormatting, Highlighter, Palette, Youtube as YoutubeIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px'];
const COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#0d9488', '#0891b2', '#7c3aed', '#db2777', '#ffffff'];

export function RichTextEditor({ value, onChange, placeholder = 'Write your content…', minHeight = 220, className }: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [imageOpen, setImageOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const [videoOpen, setVideoOpen] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, Color, Highlight, FontSize,
      Placeholder.configure({ placeholder }),
      Youtube.configure({ controls: true, nocookie: true, width: 640, height: 360 }),
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'mc-prose focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, disabled, title, children }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={cn(
        'h-8 w-8 rounded-md flex items-center justify-center transition-colors',
        active ? 'bg-[var(--mc-primary)] text-white' : 'hover:bg-[var(--mc-primary-light)] text-[var(--mc-text-secondary)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn('rounded-xl border border-[var(--mc-divider)] overflow-hidden bg-white', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-[var(--mc-bg-card)]">
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo2 className="h-4 w-4" />
        </ToolBtn>
        <div className="w-px h-5 bg-[var(--mc-divider)] mx-1" />
        <select
          className="h-8 text-xs rounded-md border border-[var(--mc-divider)] bg-white px-1.5"
          onChange={e => {
            const v = e.target.value;
            if (v === 'paragraph') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(v) as 1 | 2 | 3 }).run();
          }}
          value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : editor.isActive('paragraph') ? 'paragraph' : 'paragraph'}
        >
          <option value="paragraph">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
        <select
          className="h-8 text-xs rounded-md border border-[var(--mc-divider)] bg-white px-1.5"
          onChange={e => {
            if (e.target.value) editor.chain().focus().setMark('textStyle', { fontSize: e.target.value }).run();
          }}
          value=""
        >
          <option value="">Size</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="w-px h-5 bg-[var(--mc-divider)] mx-1" />
        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolBtn>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" title="Text color" className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-[var(--mc-primary-light)] text-[var(--mc-text-secondary)]">
              <Palette className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} type="button" className="h-6 w-6 rounded-full border border-gray-300"
                  style={{ background: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <ToolBtn title="Highlight" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter className="h-4 w-4" />
        </ToolBtn>
        <div className="w-px h-5 bg-[var(--mc-divider)] mx-1" />
        <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="h-4 w-4" />
        </ToolBtn>
        <div className="w-px h-5 bg-[var(--mc-divider)] mx-1" />
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Insert link" className={cn('h-8 w-8 rounded-md flex items-center justify-center', editor.isActive('link') ? 'bg-[var(--mc-primary)] text-white' : 'hover:bg-[var(--mc-primary-light)] text-[var(--mc-text-secondary)]')}>
              <Link2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2">
            <div className="flex gap-2">
              <Input className="mc-input h-8 text-xs" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
              <Button size="sm" className="h-8" onClick={() => {
                if (linkUrl) {
                  editor.chain().focus().setLink({ href: linkUrl }).run();
                  setLinkUrl(''); setLinkOpen(false);
                }
              }}>Set</Button>
              {editor.isActive('link') && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => editor.chain().focus().unsetLink().run()}>Remove</Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Insert image" className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-[var(--mc-primary-light)] text-[var(--mc-text-secondary)]">
              <ImagePlus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2">
            <div className="flex gap-2">
              <Input className="mc-input h-8 text-xs" placeholder="Image URL (https://...)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
              <Button size="sm" className="h-8" onClick={() => {
                if (imageUrl) {
                  editor.chain().focus().setImage({ src: imageUrl }).run();
                  setImageUrl(''); setImageOpen(false);
                }
              }}>Insert</Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={videoOpen} onOpenChange={setVideoOpen}>
          <PopoverTrigger asChild>
            <button type="button" title="Insert YouTube video" className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-[var(--mc-primary-light)] text-[var(--mc-text-secondary)]">
              <YoutubeIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2">
            <div className="flex gap-2">
              <Input className="mc-input h-8 text-xs" placeholder="YouTube URL" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
              <Button size="sm" className="h-8" onClick={() => {
                if (videoUrl) {
                  editor.commands.setYoutubeVideo({ src: videoUrl });
                  setVideoUrl(''); setVideoOpen(false);
                }
              }}>Embed</Button>
            </div>
          </PopoverContent>
        </Popover>
        <ToolBtn title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolBtn>
        <div className="flex-1" />
        <ToolBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolBtn>
      </div>

      {/* Content */}
      <EditorContent editor={editor} />

      {/* Table controls when inside a table */}
      {editor.isActive('table') && (
        <div className="flex flex-wrap gap-1 p-1.5 border-t bg-[var(--mc-bg-card)] text-xs">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</Button>
        </div>
      )}
    </div>
  );
}
