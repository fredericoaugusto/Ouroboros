'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft, Check, Copy } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { useNotification } from '../context/NotificationContext';

export interface Topic {
  topic_number?: string;
  topic_text: string;
  is_grouping_topic?: boolean;
  is_completed?: boolean;
  status?: string;
  relevance?: number;
  difficulty?: number;
  mastery?: number;
  notebookUrl?: string;
  notes?: string;
  sub_topics?: Topic[];
}

interface Subject {
  subject: string;
  topics: Topic[];
  color: string;
}

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (subjectName: string, topics: Topic[], color: string) => void;
  initialSubjectData?: Subject | null;
}

const colors = [
  '#10B981', '#059669', '#14B8A6', '#06B6D4',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
];

const formatTopicsRecursively = (topics: Topic[], level = 0): string => {
  return topics
    .map((topic) => {
      const indent = '  '.repeat(level);
      const subTopicsStr =
        topic.sub_topics && topic.sub_topics.length > 0
          ? `\n${formatTopicsRecursively(topic.sub_topics, level + 1)}`
          : '';
      return `${indent}${topic.topic_text}${subTopicsStr}`;
    })
    .join('\n');
};

const assignTopicNumbers = (topics: Topic[], prefix = ''): Topic[] => {
  return topics.map((t, index) => {
    const num = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    const hasChildren = !!(t.sub_topics && t.sub_topics.length > 0);
    return {
      ...t,
      topic_number: num,
      is_grouping_topic: hasChildren || t.is_grouping_topic,
      sub_topics: hasChildren ? assignTopicNumbers(t.sub_topics!, num) : [],
    };
  });
};

export const parseTopicsFromString = (content: string): Topic[] => {
  const lines = content.split('\n');
  const newTopics: Topic[] = [];
  const stack: { level: number; topic: Topic }[] = [];

  lines.forEach((rawLine) => {
    if (!rawLine.trim()) return;

    const expanded = rawLine.replace(/\t/g, '  ');
    const leadingSpaces = expanded.match(/^\s*/)?.[0].length || 0;
    const level = Math.floor(leadingSpaces / 2);

    let topicText = expanded.trim();
    topicText = topicText.replace(/^[-*•]\s+/, '').trim();
    const isGroupingTopic = topicText.startsWith('*');
    if (isGroupingTopic) {
      topicText = topicText.substring(1).trim();
    }
    // Remove leading manual numbering like "1.1 - " if present so we number cleanly
    topicText = topicText.replace(/^\d+(\.\d+)*[.)\s-]+\s*/, '').trim() || topicText;

    const newTopic: Topic = {
      topic_text: topicText,
      sub_topics: [],
      is_grouping_topic: isGroupingTopic,
    };

    while (stack.length > 0 && level <= stack[stack.length - 1].level) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].topic;
      parent.sub_topics = parent.sub_topics || [];
      parent.sub_topics.push(newTopic);
      parent.is_grouping_topic = true;
    } else {
      newTopics.push(newTopic);
    }

    stack.push({ level, topic: newTopic });
  });

  return assignTopicNumbers(newTopics);
};

const AddSubjectModal: React.FC<AddSubjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSubjectData,
}) => {
  const { showNotification } = useNotification();
  const [subjectName, setSubjectName] = useState('');
  const [topicsContent, setTopicsContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSubjectData) {
        setSubjectName(initialSubjectData.subject);
        setSelectedColor(initialSubjectData.color || colors[0]);
        setTopicsContent(formatTopicsRecursively(initialSubjectData.topics || []));
      } else {
        setSubjectName('');
        setTopicsContent('');
        setSelectedColor(colors[Math.floor(Math.random() * colors.length)]);
      }
    }
  }, [isOpen, initialSubjectData]);

  if (!isOpen) return null;

  const handleCopyDisciplinePrompt = async () => {
    const prompt = `Organize os tópicos e subtópicos da disciplina abaixo em uma lista hierárquica simples (apenas texto puro, sem markdown extra), usando 2 espaços de recuo para subtópicos e 4 espaços para sub-subtópicos.

Exemplo do formato exato esperado:
Atos Administrativos
  Conceito e Requisitos
  Atributos dos Atos
    Presunção de Legitimidade
    Autoexecutoriedade
  Extinção dos Atos Administrativos
Poderes da Administração
  Poder de Polícia
  Poder Hierárquico

Conteúdo da disciplina para organizar:
[COLE OS TÓPICOS AQUI]`;

    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    showNotification('Prompt padrão de disciplina copiado!', 'success');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (subjectName.trim()) {
      const topics = parseTopicsFromString(topicsContent);
      onSave(subjectName.trim(), topics, selectedColor);
      onClose();
    } else {
      showNotification('O nome da disciplina não pode estar vazio.', 'error');
    }
  };

  const previewCount = parseTopicsFromString(topicsContent).length;

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Disciplinas', onClick: onClose },
              { label: initialSubjectData ? `Editar: ${initialSubjectData.subject}` : 'Nova Disciplina' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1f304a] w-full overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: selectedColor }}
              >
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {initialSubjectData ? 'Editar Disciplina' : 'Nova Disciplina'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Defina o nome, cor e cole os tópicos e subtópicos de uma só vez
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Nome da Disciplina *
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Ex: Direito Administrativo"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Cor de Identificação
              </label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552]">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {colors.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-4 h-4 rounded-full transition-transform ${
                        selectedColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Topics Bulk Textarea */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tópicos e Subtópicos ({previewCount} tópicos raiz detectados)
              </label>
              <button
                type="button"
                onClick={handleCopyDisciplinePrompt}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPrompt ? 'Prompt Copiado!' : 'Copiar Padrão para IA'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Digite um tópico por linha. Use <strong>2 espaços</strong> no início da linha para criar um subtópico (`1.1`) e <strong>4 espaços</strong> para sub-subtópico (`1.1.1`).
            </p>
            <textarea
              value={topicsContent}
              onChange={(e) => setTopicsContent(e.target.value)}
              placeholder={`Exemplo:\nAtos Administrativos\n  Conceito e Requisitos\n  Atributos do Ato Administrativo\n    Presunção de Legitimidade\n    Autoexecutoriedade\nPoderes Administrativos\n  Poder de Polícia\n  Poder Disciplinar`}
              rows={11}
              className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#1f304a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              {initialSubjectData ? 'Salvar Alterações' : 'Criar Disciplina'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default AddSubjectModal;
