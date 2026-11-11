'use client';

import React, { useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import StopwatchModal from './StopwatchModal';
import {
  useGlobalTimer,
  toggleGlobalTimer,
  resetGlobalTimer,
  syncGlobalTimerMetadata,
} from '../lib/timerStore';
import { getSubjectTopicOverride } from './TopicQueueSelectorModal';

export default function GlobalFooterTimer() {
  const pathname = usePathname();
  const { isSidebarExpanded } = useSidebar();
  const {
    currentStudySession,
    setIsRegisterModalOpen,
    setInitialStudyRecord,
    isStopwatchModalOpen,
    setIsStopwatchModalOpen,
    stopwatchTargetDuration,
    stopwatchModalSubject,
    stats,
    studyCycle,
    sessionProgressMap,
    studyRecords,
  } = useData();

  const timerState = useGlobalTimer();

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

  const plannedSubjectName =
    activePlanningSession?.subject || 'Selecione uma matéria';
  const plannedSubjectColor =
    activePlanningSession?.color || '#10b981';

  const remainingBlockMinutes = useMemo(() => {
    if (!activePlanningSession) return null;
    const prog = sessionProgressMap?.[activePlanningSession.id as string] || 0;
    return Math.max(1, Math.round(activePlanningSession.duration - prog));
  }, [activePlanningSession, sessionProgressMap]);

  // Encontra o próximo tópico sugerido do edital para a matéria atual
  const suggestedTopic = useMemo(() => {
    const subjName = timerState.hasStarted && timerState.subject
      ? timerState.subject
      : plannedSubjectName;
    if (!subjName || subjName === 'Selecione uma matéria') return '';

    const manualOverride = getSubjectTopicOverride(subjName);
    if (manualOverride) return manualOverride;

    const subjData = stats?.editalData?.find(
      (s) => s.subject?.toLowerCase() === subjName?.toLowerCase()
    );
    if (!subjData || !subjData.topics) return '';

    const completedSet = new Set(
      (studyRecords || [])
        .filter((r) => r.subject === subjName && r.teoriaFinalizada)
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
  }, [timerState.hasStarted, timerState.subject, plannedSubjectName, stats?.editalData, studyRecords]);

  // Mantém os metadados do timer sincronizados com o bloco atual do planejamento quando o timer está parado
  useEffect(() => {
    if (plannedSubjectName && plannedSubjectName !== 'Selecione uma matéria') {
      syncGlobalTimerMetadata({
        subject: plannedSubjectName,
        topic: suggestedTopic,
        subjectColor: plannedSubjectColor,
        targetDurationMinutes: remainingBlockMinutes || undefined,
      });
    }
  }, [plannedSubjectName, suggestedTopic, plannedSubjectColor, remainingBlockMinutes]);

  if (['/login', '/register'].includes(pathname)) {
    return null;
  }

  const formatTimeMs = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  // Exibe na barra inferior exatamente o mesmo relógio do Modo Foco (regressivo se estiver em modo timer ativo, ou progressivo)
  const displayMs =
    timerState.mode === 'timer' && timerState.targetDurationMs > 0 && timerState.hasStarted
      ? Math.max(0, timerState.targetDurationMs - timerState.elapsedMs)
      : timerState.elapsedMs;

  const currentSubjectName =
    timerState.hasStarted && timerState.subject
      ? timerState.subject
      : plannedSubjectName;
  const currentSubjectColor =
    timerState.hasStarted && timerState.subjectColor
      ? timerState.subjectColor
      : plannedSubjectColor;
  const currentTopicName =
    timerState.hasStarted && timerState.topic
      ? timerState.topic
      : suggestedTopic;

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

  const handleOpenRegister = (customElapsedMs?: number, customSubj?: string, customTop?: string) => {
    const elapsedMs =
      customElapsedMs !== undefined ? customElapsedMs : Math.max(0, timerState.elapsedMs);
    const finalSubj =
      customSubj ||
      (currentSubjectName !== 'Selecione uma matéria' ? currentSubjectName : '');
    const finalTopic = customTop || currentTopicName || '';

    resetGlobalTimer();
    setIsStopwatchModalOpen(false);

    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subjectId: activePlanningSession?.subjectId || '',
        subject: finalSubj,
        topic: finalTopic,
        studyTime: elapsedMs,
        date: todayStr,
        category: 'teoria',
        countInPlanning: true,
      });
    }
    setIsRegisterModalOpen(true);
  };

  return (
    <>
      {/* Modo Foco Sincronizado (StopwatchModal Global) */}
      <StopwatchModal
        isOpen={isStopwatchModalOpen}
        onClose={() => setIsStopwatchModalOpen(false)}
        onSaveAndClose={(time, subject, topic) => {
          handleOpenRegister(time, subject, topic);
        }}
        targetDuration={stopwatchTargetDuration || remainingBlockMinutes || 45}
        subject={stopwatchModalSubject || (currentSubjectName !== 'Selecione uma matéria' ? currentSubjectName : '')}
        initialTopic={currentTopicName}
      />

      {/* Barra Persistente no Rodapé */}
      <footer
        className={`fixed bottom-0 right-0 ${
          isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
        } z-40 bg-white/95 dark:bg-[#0c1421]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1a293e] px-4 py-2.5 shadow-lg transition-all duration-300`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Lado Esquerdo: Disciplina sugerida pelo Planejamento / em estudo */}
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
                  {timerState.hasStarted ? 'Em Estudo' : 'Pelo Planejamento'}
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

          {/* Centro: Relógio Sincronizado, Tempo em Pausa e Controles */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="font-mono text-lg sm:text-2xl font-bold tracking-wider text-slate-900 dark:text-emerald-400 bg-slate-100 dark:bg-[#131f33] px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1f304a] shadow-inner">
              {formatTimeMs(displayMs)}
            </div>

            {!timerState.isRunning && timerState.hasStarted && timerState.elapsedMs > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold"
                title="Tempo em pausa"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Pausa: {formatTimeMs(timerState.pausedMs)}
              </div>
            )}

            <button
              onClick={toggleGlobalTimer}
              className={`p-2.5 rounded-full transition-all shadow-md flex items-center justify-center ${
                timerState.isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
              }`}
              title={timerState.isRunning ? 'Pausar' : 'Iniciar'}
            >
              {timerState.isRunning ? (
                <Pause size={18} />
              ) : (
                <Play size={18} className="translate-x-0.5" />
              )}
            </button>

            {timerState.elapsedMs > 0 && (
              <button
                onClick={resetGlobalTimer}
                className="p-2 text-slate-400 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                title="Zerar cronômetro"
              >
                <RotateCcw size={16} />
              </button>
            )}

            <button
              onClick={() => setIsStopwatchModalOpen(!isStopwatchModalOpen)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#131f33] hover:bg-emerald-500/15 text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors"
              title={
                isStopwatchModalOpen
                  ? 'Minimizar Modo Foco'
                  : 'Abrir Cronômetro em Modo Foco'
              }
            >
              {isStopwatchModalOpen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button
              onClick={() => handleOpenRegister()}
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
