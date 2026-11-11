'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Sparkles, BookOpen, CheckCircle2, ExternalLink } from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';

export interface TopicQueueItem {
  topic_text: string;
  is_completed: boolean;
  notebookUrl?: string;
  level: number;
}

interface TopicQueueSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectColor?: string;
  topics: any[];
  completedTopicNames?: Set<string>;
  currentSelectedTopic?: string;
  onSelectTopic: (topicText: string) => void;
}

const STORAGE_KEY_PREFIX = 'krono_selected_topic_override::';

export function getSubjectTopicOverride(subjectName: string): string | null {
  if (typeof window === 'undefined' || !subjectName) return null;
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${subjectName.trim().toLowerCase()}`);
  } catch {
    return null;
  }
}

export function setSubjectTopicOverride(subjectName: string, topicText: string | null) {
  if (typeof window === 'undefined' || !subjectName) return;
  try {
    const key = `${STORAGE_KEY_PREFIX}${subjectName.trim().toLowerCase()}`;
    if (!topicText) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, topicText);
    }
    window.dispatchEvent(
      new CustomEvent('krono:topic-override-changed', {
        detail: { subjectName, topicText },
      })
    );
  } catch {
    // ignore storage errors
  }
}

export default function TopicQueueSelectorModal({
  isOpen,
  onClose,
  subjectName,
  subjectColor = '#10b981',
  topics = [],
  completedTopicNames,
  currentSelectedTopic,
  onSelectTopic,
}: TopicQueueSelectorModalProps) {
  const { isSidebarExpanded } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicText, setSelectedTopicText] = useState(currentSelectedTopic || '');

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedTopicText(currentSelectedTopic || '');
    }
  }, [isOpen, currentSelectedTopic]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Achata a árvore de tópicos preservando a ordem do edital
  const flatTopics = useMemo<TopicQueueItem[]>(() => {
    const result: TopicQueueItem[] = [];
    const traverse = (list: any[], level = 0) => {
      for (const t of list || []) {
        const hasChildren = Boolean(t.sub_topics && t.sub_topics.length > 0);
        if (!hasChildren) {
          const isComp = Boolean(
            t.is_completed ||
              t.status === 'completed' ||
              t.status === 'studied' ||
              (completedTopicNames && completedTopicNames.has(t.topic_text))
          );
          result.push({
            topic_text: t.topic_text,
            is_completed: isComp,
            notebookUrl: t.notebookUrl,
            level,
          });
        } else {
          traverse(t.sub_topics, level + 1);
        }
      }
    };
    traverse(topics, 0);
    return result;
  }, [topics, completedTopicNames]);

  const pendingTopics = useMemo(
    () => flatTopics.filter((t) => !t.is_completed),
    [flatTopics]
  );

  const nextThreeQueue = useMemo(() => pendingTopics.slice(0, 3), [pendingTopics]);
  const naturalSuggestedTopic = nextThreeQueue[0]?.topic_text || '';

  const filteredAllTopics = useMemo(() => {
    if (!searchQuery.trim()) return flatTopics;
    const q = searchQuery.trim().toLowerCase();
    return flatTopics.filter((t) => t.topic_text.toLowerCase().includes(q));
  }, [flatTopics, searchQuery]);

  if (!isOpen) return null;

  const activeChoice = selectedTopicText || naturalSuggestedTopic;

  const handleChoose = (topicText: string) => {
    setSelectedTopicText(topicText);
    setSubjectTopicOverride(subjectName, topicText);
    onSelectTopic(topicText);
  };

  const handleConfirm = () => {
    if (activeChoice) {
      setSubjectTopicOverride(subjectName, activeChoice);
      onSelectTopic(activeChoice);
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className={`!mt-0 fixed top-0 right-0 bottom-14 ${
        isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
      } z-[70] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl max-w-3xl w-full max-h-full flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1f304a] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: subjectColor }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                O que estudar em {subjectName}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pendingTopics.length} tópicos pendentes de {flatTopics.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tópico..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-3 overflow-y-auto flex-1 space-y-5">
          {/* Próximos na sua fila */}
          {!searchQuery.trim() && nextThreeQueue.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] border border-emerald-500/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Próximos na sua fila
                </span>
                {activeChoice && activeChoice !== naturalSuggestedTopic && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectTopicOverride(subjectName, null);
                      setSelectedTopicText(naturalSuggestedTopic);
                      onSelectTopic(naturalSuggestedTopic);
                    }}
                    className="text-[11px] font-bold text-emerald-500 hover:underline"
                  >
                    Voltar ao sugerido automático
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {nextThreeQueue.map((item, idx) => {
                  const isChosen = activeChoice === item.topic_text;
                  const isSuggested = idx === 0;
                  return (
                    <div
                      key={item.topic_text}
                      onClick={() => handleChoose(item.topic_text)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isChosen
                          ? 'bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white shadow-sm'
                          : 'bg-white/80 dark:bg-[#0d1626]/90 border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-200 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                            isChosen
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-200 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold truncate">
                          {item.topic_text}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.notebookUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = item.notebookUrl!.startsWith('http')
                                ? item.notebookUrl!
                                : `https://${item.notebookUrl!}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Caderno de Questões deste tópico"
                            className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuggested && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Sugerido
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Todos os tópicos do edital */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Todos os tópicos do edital ({filteredAllTopics.length})
            </span>

            {filteredAllTopics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum tópico encontrado para “{searchQuery}”.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1a293e] border border-slate-200/80 dark:border-[#1f304a] rounded-xl overflow-hidden">
                {filteredAllTopics.map((item, idx) => {
                  const isChosen = activeChoice === item.topic_text;
                  return (
                    <div
                      key={`${item.topic_text}-${idx}`}
                      onClick={() => handleChoose(item.topic_text)}
                      className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChosen
                          ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                          : 'bg-white dark:bg-[#131f33] hover:bg-slate-50 dark:hover:bg-[#17253d]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold leading-snug ${
                            isChosen
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : item.is_completed
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {item.topic_text}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.notebookUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = item.notebookUrl!.startsWith('http')
                                ? item.notebookUrl!
                                : `https://${item.notebookUrl!}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Caderno de Questões deste tópico"
                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isChosen && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500 text-slate-950 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Escolhido
                          </span>
                        )}
                        {item.is_completed && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Concluído
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-[#1f304a] bg-slate-50/70 dark:bg-[#0d1626] flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400">
            Toque num tópico para escolher o que estudar agora
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-sm transition-all"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
