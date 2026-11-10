'use client';

import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import Link from 'next/link';
import { Play, Clock, Sparkles, ChevronRight, Calendar, BookOpen, CheckCircle2 } from 'lucide-react';

const PlanningSection = () => {
  const {
    studyCycle,
    sessionProgressMap,
    stats,
    setCurrentStudySession,
    setIsRegisterModalOpen,
    setInitialStudyRecord,
  } = useData();

  // Sugere automaticamente o próximo tópico não concluído da disciplina no edital
  const getSuggestedTopicForSubject = (subjectName: string): string => {
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

  const { uncompletedSessions, completedCount, totalCount } = useMemo(() => {
    if (!studyCycle || studyCycle.length === 0) {
      return { uncompletedSessions: [], completedCount: 0, totalCount: 0 };
    }
    const uncompleted = studyCycle.filter((session) => {
      const progress = sessionProgressMap[session.id as string] || 0;
      return progress < session.duration;
    });
    return {
      uncompletedSessions: uncompleted,
      completedCount: studyCycle.length - uncompleted.length,
      totalCount: studyCycle.length,
    };
  }, [studyCycle, sessionProgressMap]);

  const nextSession = uncompletedSessions[0] || null;
  const upcomingQueue = uncompletedSessions.slice(1, 4);
  const cyclePercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStartStudy = (session: any) => {
    const suggestedTopic = getSuggestedTopicForSubject(session.subject);
    if (setCurrentStudySession) {
      setCurrentStudySession(session);
    }
    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subjectId: session.subjectId,
        subject: session.subject,
        topic: suggestedTopic,
        studyTime: session.duration * 60,
        date: new Date().toISOString().split('T')[0],
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
            • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
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
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-slate-500/5 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: nextSession.color || '#10b981' }}
                >
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0">
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900/80 text-emerald-400 mb-1">
                    Próximo Estudo
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {nextSession.subject}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    Sugestão: <span className="font-medium">{getSuggestedTopicForSubject(nextSession.subject)}</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <Clock size={13} className="text-emerald-500" />
                    <span>{nextSession.duration} min planejados</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleStartStudy(nextSession)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all flex-shrink-0"
              >
                <Play size={14} className="fill-current" />
                Iniciar Estudo
              </button>
            </div>

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
                  {upcomingQueue.map((session, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: session.color || '#6366f1' }}
                        >
                          <BookOpen size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {session.subject}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {getSuggestedTopicForSubject(session.subject)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0">
                        <Clock size={12} /> {session.duration}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Ciclo Concluído!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Todas as sessões previstas neste ciclo foram finalizadas.
            </p>
            <Link
              href="/planejamento"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold"
            >
              Gerenciar Ciclo <ChevronRight size={14} />
            </Link>
          </div>
        )
      ) : (
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1a293e]">
          <Calendar size={24} className="text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Nenhum ciclo de estudos configurado ainda.
          </p>
          <Link
            href="/planejamento"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
          >
            Criar Planejamento <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};

export default PlanningSection;
