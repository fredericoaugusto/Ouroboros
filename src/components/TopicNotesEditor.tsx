'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Highlighter,
  Undo,
  Redo,
  ImagePlus,
  Save,
  Eraser,
  Check,
  EyeOff,
  Eye,
} from 'lucide-react';

export const ClozeExtension = Mark.create({
  name: 'cloze',
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-cloze]' },
      { tag: 'span.krono-cloze' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cloze': 'true',
        class: 'krono-cloze',
        title: 'Passe o mouse ou toque para revelar (Active Recall)',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleCloze:
        () =>
        ({ commands }: any) => {
          return commands.toggleMark(this.name);
        },
      unsetCloze:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

interface TopicNotesEditorProps {
  initialContent?: string;
  topicKey?: string;
  onChange?: (contentHtml: string) => void;
  onSave?: (contentHtml: string) => void;
}

const NEON_HIGHLIGHTS = [
  { name: 'Verde Neon', color: '#10b981', bgClass: 'bg-emerald-400' },
  { name: 'Amarelo Neon', color: '#facc15', bgClass: 'bg-yellow-400' },
  { name: 'Rosa Neon', color: '#f43f5e', bgClass: 'bg-rose-400' },
  { name: 'Azul Neon', color: '#38bdf8', bgClass: 'bg-sky-400' },
  { name: 'Roxo Neon', color: '#a855f7', bgClass: 'bg-purple-400' },
  { name: 'Laranja Neon', color: '#fb923c', bgClass: 'bg-orange-400' },
];

export default function TopicNotesEditor({
  initialContent = '',
  topicKey = 'default',
  onChange,
  onSave,
}: TopicNotesEditorProps) {
  const [justSaved, setJustSaved] = useState(false);
  const [revealAllCloze, setRevealAllCloze] = useState(false);
  const lastTopicKeyRef = useRef<string>(topicKey);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        allowBase64: true,
        inline: true,
      }),
      ClozeExtension,
    ],
    content: initialContent || '',
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[420px] text-sm text-slate-800 dark:text-slate-100 px-6 py-5 leading-relaxed',
      },
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          if (onSave && editor) {
            onSave(editor.getHTML());
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
          }
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = e => {
                const base64 = e.target?.result as string;
                if (base64) {
                  editor?.chain().focus().setImage({ src: base64 }).run();
                }
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  // Só redefine o conteúdo do editor quando mudar de tópico (topicKey diferente)
  useEffect(() => {
    if (editor && lastTopicKeyRef.current !== topicKey) {
      lastTopicKeyRef.current = topicKey;
      editor.commands.setContent(initialContent || '');
    }
  }, [topicKey, initialContent, editor]);

  if (!editor) return null;

  const handleSave = () => {
    const html = editor.getHTML();
    if (onChange) onChange(html);
    if (onSave) {
      onSave(html);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  const handleAddImage = () => {
    const url = window.prompt('Insira o link da imagem (ou copie e aperte Ctrl+V no editor):');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex flex-col border border-slate-200 dark:border-[#1f304a] rounded-2xl overflow-hidden bg-white dark:bg-[#0b1320] shadow-sm h-full">
      {/* Toolbar Superior Estilo Bússola Notes */}
      <div className="flex flex-wrap items-center gap-1 p-2.5 bg-slate-50 dark:bg-[#131f33] border-b border-slate-200 dark:border-[#1f304a] sticky top-0 z-10">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1a2942] disabled:opacity-30"
          title="Desfazer"
        >
          <Undo size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1a2942] disabled:opacity-30"
          title="Refazer"
        >
          <Redo size={15} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-[#1f304a] mx-1" />

        {/* Formatação Básica */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('bold')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('italic')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('underline')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('strike')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Tachado"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('code')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Código"
        >
          <Code size={15} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-[#1f304a] mx-1" />

        {/* Paleta de Marca-Texto Fluorescente (Estilo Bússola Notes) */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
          <Highlighter size={13} className="text-slate-400 mr-0.5" />
          {NEON_HIGHLIGHTS.map(hl => (
            <button
              key={hl.color}
              type="button"
              onClick={() =>
                editor.chain().focus().toggleHighlight({ color: hl.color }).run()
              }
              className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${hl.bgClass} ${
                editor.isActive('highlight', { color: hl.color })
                  ? 'ring-2 ring-white dark:ring-slate-200 scale-110'
                  : 'opacity-80 hover:opacity-100'
              }`}
              title={`Grifar: ${hl.name}`}
            />
          ))}
          {editor.isActive('highlight') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetHighlight().run()}
              className="p-0.5 text-slate-400 hover:text-rose-400"
              title="Remover grifo"
            >
              <Eraser size={12} />
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-slate-200 dark:bg-[#1f304a] mx-1" />

        {/* Títulos */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Título 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Título 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Título 3"
        >
          <Heading3 size={15} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-[#1f304a] mx-1" />

        {/* Listas, Checklist, Citação e Alinhamento */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Lista com marcadores"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Lista numerada"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('taskList')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Checklist"
        >
          <CheckSquare size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title="Bloco de Destaque / Jurisprudência"
        >
          <Quote size={15} />
        </button>

        {/* Inserir Imagem */}
        <button
          type="button"
          onClick={handleAddImage}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2942]"
          title="Inserir imagem (ou cole com Ctrl+V)"
        >
          <ImagePlus size={15} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-[#1f304a] mx-1" />

        {/* Cloze / Ocultar para Active Recall */}
        <button
          type="button"
          onClick={() => (editor.commands as any).toggleCloze()}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
            editor.isActive('cloze')
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50'
              : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
          }`}
          title="Selecione uma palavra/frase e clique para Ocultar (Cloze) ou Mostrar novamente"
        >
          <EyeOff size={13} />
          <span>{editor.isActive('cloze') ? 'Remover Ocultação' : 'Ocultar (Cloze)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setRevealAllCloze((prev) => !prev)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border ${
            revealAllCloze
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1f304a] hover:bg-slate-200 dark:hover:bg-[#1a2942]'
          }`}
          title={
            revealAllCloze
              ? 'Ocultar todos os termos Cloze (Modo Active Recall)'
              : 'Revelar todos os termos ocultos para facilitar leitura/edição'
          }
        >
          {revealAllCloze ? <EyeOff size={13} /> : <Eye size={13} />}
          <span className="hidden sm:inline">
            {revealAllCloze ? 'Esconder Spoilers' : 'Ver Spoilers'}
          </span>
        </button>

        <div className="flex-grow" />

        {/* Salvar */}
        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
            justSaved
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          {justSaved ? <Check size={14} /> : <Save size={14} />}
          {justSaved ? 'Salvo!' : 'Salvar Anotação'}
        </button>
      </div>

      {/* Área de Conteúdo do Caderno Digital */}
      <div
        className={`flex-grow min-h-[460px] overflow-y-auto cursor-text bg-white dark:bg-[#0b1320] ${
          revealAllCloze ? 'krono-cloze-reveal-all' : ''
        }`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target && target.classList?.contains('krono-cloze')) {
            target.classList.toggle('revealed');
          }
          editor.chain().focus().run();
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
