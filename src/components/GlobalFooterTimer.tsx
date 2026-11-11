'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useData } from '../context/DataContext';
import { useSidebar } from '../context/SidebarContext';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Clock,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

export default function GlobalFooterTimer() {
  const pathname = usePathname();
  const { isSidebarExpanded } = useSidebar();
  const {
    currentStudySession,
    setIsRegisterModalOpen,
    setInitialStudyRecord,
    stats,
    studyCycle,
    sessionProgressMap,
    studyRecords,
  } = useData();

  const [seconds, setSeconds] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFocusFullscreen, setIsFocusFullscreen] = useState(false);

  // Cronômetro principal de estudo
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Cronômetro de tempo em pausa (ativa quando o timer já iniciou mas está pausado)
  useEffect(() => {
    let pauseInterval: NodeJS.Timeout | null = null;
    if (!isRunning && seconds > 0) {
      pauseInterval = setInterval(() => {
        setPausedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (pauseInterval) clearInterval(pauseInterval);
    };
  }, [isRunning, seconds]);

  // Encontra exatamente o próximo bloco pendente na fila do ciclo
  const activePlanningSession = useMemo(() => {
    if (currentStudySession) {
      const prog = sessionProgressMap?.[currentStudySession.id as string] || 0;
      if (prog < currentStudySession.duration) {
        return currentStudySession;
      }
    }
    if (!studyCycle || studyCycle.length === 0) return null;
    return (
      studyCycle.find((s) => (sessionProgressMap?.[s.id as string] || 0) < s.duration) ||
      null
    );
  }, [currentStudySession, studyCycle, sessionProgressMap]);

  const currentSubjectName =
    activePlanningSession?.subject || 'Selecione uma matéria';
  const currentSubjectColor =
    activePlanningSession?.color || '#10b981';

  const remainingBlockMinutes = useMemo(() => {
    if (!activePlanningSession) return null;
    const prog = sessionProgressMap?.[activePlanningSession.id as string] || 0;
    return Math.max(1, Math.round(activePlanningSession.duration - prog));
  }, [activePlanningSession, sessionProgressMap]);

  // Encontra o próximo tópico sugerido do edital para a matéria atual
  const suggestedTopic = useMemo(() => {
    if (!currentSubjectName || currentSubjectName === 'Selecione uma matéria') return '';
    const subjData = stats?.editalData?.find(
      (s) => s.subject?.toLowerCase() === currentSubjectName?.toLowerCase()
    );
    if (!subjData || !subjData.topics) return '';

    const completedSet = new Set(
      (studyRecords || [])
        .filter((r) => r.subject === currentSubjectName && r.teoriaFinalizada)
        .map((r) => r.topic)
    );

    const findNext = (topics: any[]): string => {
      for (const t of topics) {
        if (t.sub_topics && t.sub_topics.length > 0) {
          const foundSub = findNext(t.sub_topics);
          if (foundSub) return foundSub;
        } else if (!t.is_completed && !completedSet.has(t.topic_text)) {
          return t.topic_text;
        }
      }
      return '';
    };

    return findNext(subjData.topics);
  }, [currentSubjectName, stats?.editalData, studyRecords]);

  if (['/login', '/register'].includes(pathname)) {
    return null;
  }

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  // Calcula o tempo estudado hoje (data local YYYY-MM-DD)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const todayMs = (studyRecords || [])
    .filter((r) => r.date && r.date.startsWith(todayStr))
    .reduce((acc, r) => acc + (r.studyTime || 0), 0);
  const todayTotalStudyMinutes = Math.round(todayMs / 60000);
  const todayHours = Math.floor(todayTotalStudyMinutes / 60);
  const todayMins = todayTotalStudyMinutes % 60;

  const handleToggleTimer = () => {
    setIsRunning((prev) => !prev);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setSeconds(0);
    setPausedSeconds(0);
  };

  const handleOpenRegister = () => {
    setIsRunning(false);
    setIsFocusFullscreen(false);
    const elapsedMs = seconds > 0 ? seconds * 1000 : 0;
    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subjectId: activePlanningSession?.subjectId || '',
        subject: currentSubjectName !== 'Selecione uma matéria' ? currentSubjectName : '',
        topic: suggestedTopic || '',
        studyTime: elapsedMs,
        date: todayStr,
        category: 'teoria',
        countInPlanning: true,
      });
    }
    setSeconds(0);
    setPausedSeconds(0);
    setIsRegisterModalOpen(true);
  };

  return (
    <>
      {/* Modo Foco em Tela Cheia */}
      {isFocusFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] dark:bg-[#0b1320] flex flex-col justify-between p-6 sm:p-10 animate-fadeIn">
          {/* Topo Modo Foco */}
          <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: currentSubjectColor }}
              >
                <BookOpen size={18} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 block">
                  Modo Foco • Tela Cheia
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  {currentSubjectName}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setIsFocusFullscreen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors"
            >
              <Minimize2 size={15} />
              Minimizar para Barra
            </button>
          </div>

          {/* Centro: Relógio Gigante */}
          <div className="max-w-3xl w-full mx-auto text-center space-y-6 my-auto">
            {suggestedTopic && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <Sparkles size={14} />
                <span>Tópico sugerido: {suggestedTopic}</span>
              </div>
            )}

            <div className="py-12 px-8 rounded-3xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-2xl relative overflow-hidden">
              <div className="text-6xl sm:text-8xl font-mono font-black tracking-wider text-slate-900 dark:text-emerald-400">
                {formatTime(seconds)}
              </div>

              <div className="mt-4 flex items-center justify-center gap-4 flex-wrap">
                {remainingBlockMinutes !== null && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Meta restante do bloco: <strong>{remainingBlockMinutes} min</strong>
                  </span>
                )}
                {!isRunning && seconds > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold animate-pulse">
                    Pausado há {formatTime(pausedSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Controles Principais */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggleTimer}
                className={`inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-extrabold shadow-lg transition-all ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                }`}
              >
                {isRunning ? <Pause size={20} /> : <Play size={20} />}
                {isRunning ? 'Pausar Cronômetro' : seconds > 0 ? 'Retomar Estudo' : 'Iniciar Estudo'}
              </button>

              {seconds > 0 && (
                <button
                  onClick={handleResetTimer}
                  className="p-4 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-slate-500 hover:text-rose-500 transition-colors"
                  title="Zerar cronômetro"
                >
                  <RotateCcw size={18} />
                </button>
              )}

              <button
                onClick={handleOpenRegister}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-extrabold shadow-lg shadow-indigo-500/25 transition-all"
              >
                <CheckCircle2 size={18} />
                Concluir e Registrar Estudo
              </button>
            </div>
          </div>

          {/* Rodapé Modo Foco */}
          <div className="max-w-5xl w-full mx-auto flex items-center justify-between text-xs text-slate-400">
            <span>Acumulado hoje: {todayHours}h{todayMins > 0 ? `${todayMins}m` : '00m'}</span>
            <span>Pressione Minimizar para continuar navegando com o timer no rodapé</span>
          </div>
        </div>
      )}

      {/* Barra Persistente no Rodapé */}
      <footer
        className={`fixed bottom-0 right-0 ${
          isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
        } z-40 bg-white/95 dark:bg-[#0c1421]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1a293e] px-4 py-2.5 shadow-lg transition-all duration-300`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Lado Esquerdo: Disciplina sugerida pelo Planejamento */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0"
              style={{ backgroundColor: currentSubjectColor }}
            >
              <BookOpen size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                  Pelo Planejamento
                </span>
                {remainingBlockMinutes !== null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {remainingBlockMinutes}m restantes
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                {currentSubjectName}
              </p>
            </div>
          </div>

          {/* Centro: Relógio, Tempo em Pausa e Controles */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="font-mono text-lg sm:text-2xl font-bold tracking-wider text-slate-900 dark:text-emerald-400 bg-slate-100 dark:bg-[#131f33] px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1f304a] shadow-inner">
              {formatTime(seconds)}
            </div>

            {!isRunning && seconds > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold"
                title="Tempo em pausa"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Pausa: {formatTime(pausedSeconds)}
              </div>
            )}

            <button
              onClick={handleToggleTimer}
              className={`p-2.5 rounded-full transition-all shadow-md flex items-center justify-center ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
              }`}
              title={isRunning ? 'Pausar' : 'Iniciar'}
            >
              {isRunning ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
            </button>

            {seconds > 0 && (
              <button
                onClick={handleResetTimer}
                className="p-2 text-slate-400 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                title="Zerar cronômetro"
              >
                <RotateCcw size={16} />
              </button>
            )}

            <button
              onClick={() => setIsFocusFullscreen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#131f33] hover:bg-emerald-500/15 text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors"
              title="Expandir Cronômetro em Tela Cheia (Modo Foco)"
            >
              <Maximize2 size={15} />
            </button>

            <button
              onClick={handleOpenRegister}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-slate-950 border border-emerald-500/30 text-xs font-bold transition-all"
            >
              <CheckCircle2 size={15} />
              <span>Registrar Estudo</span>
            </button>
          </div>

          {/* Lado Direito: Horas estudadas hoje */}
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
            <Clock size={15} className="text-emerald-500 dark:text-emerald-400" />
            <span>
              Hoje:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {todayHours}h{todayMins > 0 ? `${todayMins}m` : '00m'}
              </strong>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
