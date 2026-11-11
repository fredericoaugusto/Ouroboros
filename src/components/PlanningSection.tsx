'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import Link from 'next/link';
import {
  Play,
  Clock,
  Sparkles,
  ChevronRight,
  Calendar,
  BookOpen,
  CheckCircle2,
  Plus,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import TopicQueueSelectorModal, {
  getSubjectTopicOverride,
} from './TopicQueueSelectorModal';
import { findTopicNotebookUrl } from '../lib/scoreEngine';
import { startGlobalTimerSession } from '../lib/timerStore';

const PlanningSection = () => {
  const {
    studyCycle,
    sessionProgressMap,
    stats,
    setCurrentStudySession,
    setIsRegisterModalOpen,
    setIsStopwatchModalOpen,
    setStopwatchTargetDuration,
    setStopwatchModalSubject,
    setInitialStudyRecord,
  } = useData();

  const [overrideVersion, setOverrideVersion] = useState(0);
  const [topicModalTarget, setTopicModalTarget] = useState<{
    subjectName: string;
    subjectColor: string;
    topics: any[];
    currentTopic: string;
  } | null>(null);

  useEffect(() => {
    const handler = () => setOverrideVersion((v) => v + 1);
    window.addEventListener('krono:topic-override-changed', handler);
    return () => window.removeEventListener('krono:topic-override-changed', handler);
  }, []);

  // Sugere automaticamente o próximo tópico não concluído da disciplina no edital (ou o escolhido pelo usuário)
  const getSuggestedTopicForSubject = (subjectName: string): string => {
    void overrideVersion;
    const manualChoice = getSubjectTopicOverride(subjectName);
    if (manualChoice) return manualChoice;

    const editalSubjects = stats?.editalData || [];
    const foundSubject = editalSubjects.find(
      (s: any) => s.subject?.toLowerCase() === subjectName?.toLowerCase()
    );
    if (!foundSubject || !foundSubject.topics) return 'Tópico livre / Revisão geral';

    const findFirstUncompleted = (topics: any[]): string | null => {
      for (const t of topics) {
        if (t.sub_topics && t.sub_topics.length > 0) {
          const subResult = findFirstUncompleted(t.sub_topics);
          if (subResult) return subResult;
        } else if (!t.is_completed) {
          return t.topic_text;
        }
      }
      return null;
    };

    return findFirstUncompleted(foundSubject.topics) || 'Todos os tópicos concluídos (Revisão)';
  };

  const openTopicSelectorForSubject = (subjectName: string, subjectColor?: string) => {
    const editalSubjects = stats?.editalData || [];
    const foundSubject = editalSubjects.find(
      (s: any) => s.subject?.toLowerCase() === subjectName?.toLowerCase()
    );
    setTopicModalTarget({
      subjectName,
      subjectColor: subjectColor || foundSubject?.color || '#10b981',
      topics: foundSubject?.topics || [],
      currentTopic: getSuggestedTopicForSubject(subjectName),
    });
  };

  const { uncompletedSessions, cyclePercentage, totalCount } = useMemo(() => {
    if (!studyCycle || studyCycle.length === 0) {
      return { uncompletedSessions: [], cyclePercentage: 0, totalCount: 0 };
    }
    const uncompleted = studyCycle.filter((session) => {
      const progress = sessionProgressMap[session.id as string] || 0;
      return progress < session.duration;
    });
    const totalDuration = studyCycle.reduce((acc, s) => acc + s.duration, 0);
    const totalStudied = studyCycle.reduce(
      (acc, s) => acc + Math.min(s.duration, sessionProgressMap[s.id as string] || 0),
      0
    );
    const pct = totalDuration > 0 ? Math.min(100, Math.round((totalStudied / totalDuration) * 100)) : 0;

    return {
      uncompletedSessions: uncompleted,
      cyclePercentage: pct,
      totalCount: studyCycle.length,
    };
  }, [studyCycle, sessionProgressMap]);

  const nextSession = uncompletedSessions[0] || null;
  const upcomingQueue = uncompletedSessions.slice(1, 4);

  const nextSessionProgress = nextSession
    ? Math.round(sessionProgressMap[nextSession.id as string] || 0)
    : 0;
  const nextSessionRemaining = nextSession
    ? Math.max(1, Math.round(nextSession.duration - nextSessionProgress))
    : 0;
  const nextSessionPct =
    nextSession && nextSession.duration > 0
      ? Math.min(100, Math.round((nextSessionProgress / nextSession.duration) * 100))
      : 0;

  const handleStartStudyTimer = (session: any) => {
    const suggestedTopic = getSuggestedTopicForSubject(session.subject);
    const prog = Math.round(sessionProgressMap[session.id as string] || 0);
    const remainingMin = Math.max(1, Math.round(session.duration - prog));

    if (setCurrentStudySession) {
      setCurrentStudySession(session);
    }
    if (setStopwatchTargetDuration) {
      setStopwatchTargetDuration(remainingMin);
    }
    if (setStopwatchModalSubject) {
      setStopwatchModalSubject(session.subject);
    }
    startGlobalTimerSession({
      subject: session.subject,
      topic: suggestedTopic,
      subjectColor: session.color || '#10b981',
      targetDurationMinutes: remainingMin,
      autoStart: true,
    });
    if (setIsStopwatchModalOpen) {
      setIsStopwatchModalOpen(true);
    }
  };

  const handleOpenManualRegister = (session: any) => {
    const suggestedTopic = getSuggestedTopicForSubject(session.subject);
    if (setCurrentStudySession) {
      setCurrentStudySession(session);
    }
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')}`;
    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subjectId: session.subjectId,
        subject: session.subject,
        topic: suggestedTopic,
        studyTime: 0,
        date: todayLocal,
        category: 'teoria',
        countInPlanning: true,
      });
    }
    setIsRegisterModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Planejamento do Dia
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
            •{' '}
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {cyclePercentage}%
            </span>
            <span className="text-[11px] text-slate-400">do ciclo concluído</span>
          </div>
        )}
      </div>

      {studyCycle && studyCycle.length > 0 ? (
        nextSession ? (
          <div className="space-y-4">
            {/* Card Principal Destacado (Estilo Estudei) */}
            {(() => {
              const activeTopicText = getSuggestedTopicForSubject(nextSession.subject);
              const notebookUrl = findTopicNotebookUrl(
                stats?.editalData,
                nextSession.subject,
                activeTopicText
              );

              return (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-slate-500/5 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <Link
                      href={`/materias/${encodeURIComponent(nextSession.subject)}`}
                      title={`Ir para a disciplina ${nextSession.subject}`}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 mt-0.5 hover:scale-105 transition-transform"
                      style={{ backgroundColor: nextSession.color || '#10b981' }}
                    >
                      <BookOpen size={20} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900/80 text-emerald-400">
                          Próximo Estudo
                        </span>
                        {nextSessionProgress > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Em andamento ({nextSessionPct}%)
                          </span>
                        )}
                      </div>

                      {/* Nome da Disciplina Clicável -> Vai direto para a página da Disciplina */}
                      <Link
                        href={`/materias/${encodeURIComponent(nextSession.subject)}`}
                        className="text-base font-extrabold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors truncate block"
                        title={`Abrir página da disciplina ${nextSession.subject}`}
                      >
                        {nextSession.subject}
                      </Link>

                      {/* Tópico Sugerido Clicável com Sublinhado Tracejado + Tooltip + Seletor da Fila */}
                      <div className="relative group/topic inline-flex items-center gap-1.5 max-w-full mt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            openTopicSelectorForSubject(nextSession.subject, nextSession.color)
                          }
                          className="text-xs text-slate-700 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400 border-b border-dashed border-slate-400 dark:border-slate-500 hover:border-emerald-500 pb-0.5 truncate inline-flex items-center gap-1.5 max-w-full text-left transition-colors"
                        >
                          <span className="truncate">{activeTopicText}</span>
                          <Pencil size={11} className="shrink-0 opacity-75" />
                        </button>

                        {notebookUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = notebookUrl.startsWith('http')
                                ? notebookUrl
                                : `https://${notebookUrl}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Caderno de Questões deste tópico"
                            className="p-1 rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors shrink-0"
                          >
                            <ExternalLink size={12} />
                          </button>
                        )}

                        {/* Tooltip Estilo Estudei (Print 1) */}
                        <div className="pointer-events-none opacity-0 group-hover/topic:opacity-100 transition-opacity duration-200 absolute bottom-full left-0 mb-2 w-60 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium text-center shadow-xl z-30">
                          Sugerido a partir do seu edital, na ordem dele. Toque para escolher outro.
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <Clock size={13} className="text-emerald-500 shrink-0" />
                        {nextSessionProgress > 0 ? (
                          <span>
                            Faltam{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {nextSessionRemaining} min
                            </strong>{' '}
                            ({nextSessionProgress}min / {nextSession.duration}min concluídos)
                          </span>
                        ) : (
                          <span>{nextSession.duration} min planejados</span>
                        )}
                      </div>
                      {nextSessionProgress > 0 && (
                        <div className="w-full max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-[#0c1421] mt-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${nextSessionPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleStartStudyTimer(nextSession)}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all"
                    >
                      <Play size={14} className="fill-current" />
                      Iniciar estudo
                    </button>
                    <button
                      onClick={() => handleOpenManualRegister(nextSession)}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-[#131f33] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#243552] hover:border-emerald-500 transition-colors"
                      title="Registrar Estudo Manual"
                    >
                      + Manual
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Fila dos Próximos Estudos */}
            {upcomingQueue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Próximos da Fila
                  </span>
                  <Link
                    href="/planejamento"
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    Ver planejamento completo <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-[#1a293e]">
                  {upcomingQueue.map((session, idx) => {
                    const prog = Math.round(sessionProgressMap[session.id as string] || 0);
                    const rem = Math.max(1, Math.round(session.duration - prog));
                    const topicStr = getSuggestedTopicForSubject(session.subject);
                    const qNotebookUrl = findTopicNotebookUrl(
                      stats?.editalData,
                      session.subject,
                      topicStr
                    );
                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Link
                            href={`/materias/${encodeURIComponent(session.subject)}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:scale-105 transition-transform"
                            style={{ backgroundColor: session.color || '#6366f1' }}
                            title={`Ir para ${session.subject}`}
                          >
                            <BookOpen size={14} />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/materias/${encodeURIComponent(session.subject)}`}
                              className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-500 transition-colors truncate block"
                            >
                              {session.subject}
                            </Link>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openTopicSelectorForSubject(session.subject, session.color)
                                }
                                title="Toque para escolher outro tópico"
                                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-500 border-b border-dashed border-transparent hover:border-emerald-500 truncate inline-flex items-center gap-1 transition-colors"
                              >
                                <span className="truncate">{topicStr}</span>
                                <Pencil size={10} className="shrink-0 opacity-60" />
                              </button>
                              {qNotebookUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = qNotebookUrl.startsWith('http')
                                      ? qNotebookUrl
                                      : `https://${qNotebookUrl}`;
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                  }}
                                  title="Abrir Caderno de Questões deste tópico"
                                  className="p-0.5 rounded text-indigo-500 hover:text-indigo-400 shrink-0"
                                >
                                  <ExternalLink size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Clock size={12} /> {prog > 0 ? `${rem}m restantes` : `${session.duration}m`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Ciclo de estudos concluído!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Parabéns! Você finalizou todas as sessões deste ciclo.
            </p>
            <Link
              href="/planejamento"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
            >
              Ver Planejamento <ChevronRight size={14} />
            </Link>
          </div>
        )
      ) : (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhum ciclo de estudos configurado
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Monte seu ciclo automático por peso e domínio na aba Planejamento.
              </p>
            </div>
          </div>
          <Link
            href="/planejamento"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-all"
          >
            <Plus size={14} />
            Criar Ciclo
          </Link>
        </div>
      )}

      {topicModalTarget && (
        <TopicQueueSelectorModal
          isOpen={!!topicModalTarget}
          onClose={() => setTopicModalTarget(null)}
          subjectName={topicModalTarget.subjectName}
          subjectColor={topicModalTarget.subjectColor}
          topics={topicModalTarget.topics}
          currentSelectedTopic={topicModalTarget.currentTopic}
          onSelectTopic={() => setOverrideVersion((v) => v + 1)}
        />
      )}
    </div>
  );
};

export default PlanningSection;
