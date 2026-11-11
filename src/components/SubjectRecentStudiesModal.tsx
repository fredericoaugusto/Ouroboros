'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Clock,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { StudyRecord } from '../context/DataContext';
import { useSidebar } from '../context/SidebarContext';
import { findTopicNotebookUrl } from '../lib/scoreEngine';

interface SubjectRecentStudiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectColor?: string;
  studyRecords: StudyRecord[];
  editalSubjects?: any[];
}

const categoryBadgeMap: Record<string, { label: string; className: string }> = {
  teoria: {
    label: 'Teoria',
    className:
      'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/25',
  },
  questoes: {
    label: 'Questões',
    className:
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25',
  },
  revisao: {
    label: 'Revisão',
    className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/25',
  },
  leitura_lei: {
    label: 'Lei Seca',
    className:
      'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/25',
  },
  jurisprudencia: {
    label: 'Jurisprudência',
    className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/25',
  },
};

const ERROR_REASON_LABELS: Record<string, string> = {
  teoria: '📚 Lacuna de Teoria',
  letra_lei: '⚖️ Letra de Lei / Prazo',
  jurisprudencia: '🏛️ Jurisprudência',
  atencao: '⚡ Desatenção / Pegadinha',
};

export default function SubjectRecentStudiesModal({
  isOpen,
  onClose,
  subjectName,
  subjectColor = '#10b981',
  studyRecords,
  editalSubjects = [],
}: SubjectRecentStudiesModalProps) {
  const { isSidebarExpanded } = useSidebar();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setExpandedId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const recentFive = useMemo(() => {
    return (studyRecords || [])
      .filter((r) => r.subject?.toLowerCase() === subjectName?.toLowerCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [studyRecords, subjectName]);

  if (!isOpen) return null;

  const formatShortDate = (dateStr: string) => {
    const clean = (dateStr || '').split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    return dateStr;
  };

  const formatDuration = (ms: number) => {
    const mins = Math.max(1, Math.round((ms || 0) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? `${m}min` : ''}` : `${m}min`;
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
        className="bg-white dark:bg-[#182232] border border-slate-200 dark:border-[#26354d] rounded-2xl max-w-3xl w-full max-h-full flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header estilo Estudei Print 1 & 2 */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-[#243247] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: subjectColor }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Últimos estudos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {subjectName} · os {recentFive.length} mais recentes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#223046] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista dos 5 estudos mais recentes */}
        <div className="px-6 py-3 overflow-y-auto divide-y divide-slate-100 dark:divide-[#243247]">
          {recentFive.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Nenhum estudo registrado para <strong>{subjectName}</strong> ainda.
            </div>
          ) : (
            recentFive.map((rec, idx) => {
              const rowKey = rec.id || `${rec.date}-${idx}`;
              const isExpanded = expandedId === rowKey;
              const cat = categoryBadgeMap[rec.category] || {
                label: rec.category || 'Estudo',
                className:
                  'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/25',
              };
              const qTotal = rec.questions?.total || 0;
              const qCorrect = rec.questions?.correct || 0;
              const qPct = qTotal > 0 ? Math.round((qCorrect / qTotal) * 100) : null;

              const pagesList = Array.isArray(rec.pages) ? rec.pages : [];
              const firstPage = pagesList[0];
              const pagesLabel =
                firstPage && (firstPage.start || firstPage.end)
                  ? `p. ${firstPage.start || 1} ~ ${firstPage.end || firstPage.start}`
                  : (rec as any).pagesRead
                  ? `p. ${(rec as any).pagesRead}`
                  : null;

              const videosList = Array.isArray(rec.videos)
                ? rec.videos.filter((v) => v.title && v.title.trim())
                : [];
              const materialText = (rec as any).material || '—';
              const commentText = rec.notes || (rec as any).comments || '—';
              const errorReasons: string[] = (rec as any).errorReasons || [];

              const notebookUrl = findTopicNotebookUrl(
                editalSubjects,
                rec.subject,
                rec.topic
              );

              return (
                <div key={rowKey} className="py-3.5">
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 cursor-pointer group"
                  >
                    {/* Lado Esquerdo: Data + Categoria + Tópico */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-400 shrink-0 w-14">
                        {formatShortDate(rec.date)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${cat.className}`}
                      >
                        {cat.label}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-500 transition-colors">
                        {rec.topic || 'Tópico geral'}
                      </span>
                    </div>

                    {/* Lado Direito: Tempo + Questões + % + Páginas + Caderno + Seta */}
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDuration(rec.studyTime)}
                      </span>

                      {qTotal > 0 && (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                            <strong className="text-emerald-500">{qCorrect}</strong> / {qTotal}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                              (qPct || 0) >= 75
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : (qPct || 0) >= 55
                                ? 'bg-amber-500/20 text-amber-500'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {qPct}%
                          </span>
                        </div>
                      )}

                      {pagesLabel && (
                        <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
                          <FileText className="w-3.5 h-3.5" />
                          {pagesLabel}
                        </span>
                      )}

                      {notebookUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(notebookUrl, '_blank', 'noopener,noreferrer');
                          }}
                          title="Abrir Caderno de Questões deste tópico"
                          className="p-1 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <span className="text-slate-400 group-hover:text-white transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Box Expandido (Estilo Estudei Print 2) */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-[#131c2b] border border-slate-200/80 dark:border-[#26354d] space-y-3 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                            Material
                          </span>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">
                            {materialText}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                            Vídeos
                          </span>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">
                            {videosList.length > 0
                              ? videosList.map((v) => v.title).join(', ')
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                          Comentário
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {commentText}
                        </p>
                      </div>

                      {errorReasons.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-[#243247] flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                            Diagnóstico de Erros:
                          </span>
                          {errorReasons.map((er) => (
                            <span
                              key={er}
                              className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 dark:text-rose-300 border border-rose-500/20 text-[10px] font-semibold"
                            >
                              {ERROR_REASON_LABELS[er] || er}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
