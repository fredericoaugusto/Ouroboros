'use client';

import React, { useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useSidebar } from '../context/SidebarContext';
import Breadcrumbs from './Breadcrumbs';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  Timer,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import {
  useGlobalTimer,
  toggleGlobalTimer,
  setGlobalTimerMode,
  resetGlobalTimer,
  startGlobalTimerSession,
} from '../lib/timerStore';
import { findTopicNotebookUrl } from '../lib/scoreEngine';

interface StopwatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndClose: (time: number, subject?: string, topic?: string) => void;
  targetDuration?: number; // in minutes
  subject?: string;
  initialTopic?: string;
}

const StopwatchModal: React.FC<StopwatchModalProps> = ({
  isOpen,
  onClose,
  onSaveAndClose,
  targetDuration = 0,
  subject: initialSubject,
  initialTopic,
}) => {
  const { stats } = useData();
  const { isSidebarExpanded } = useSidebar();
  const timerState = useGlobalTimer();

  useEffect(() => {
    if (isOpen && initialSubject) {
      // Se ainda não iniciou um cronômetro ativo, ou se mudou a matéria alvo ao abrir o Modo Foco, sincroniza
      if (!timerState.hasStarted || timerState.subject !== initialSubject) {
        startGlobalTimerSession({
          subject: initialSubject,
          topic: initialTopic || timerState.topic,
          targetDurationMinutes: targetDuration,
          autoStart: true,
        });
      }
    }
  }, [isOpen, initialSubject, initialTopic, targetDuration]);

  const activeSubject = timerState.subject || initialSubject || 'Estudo Livre';
  const activeTopic = timerState.topic || initialTopic || 'Tópico geral';

  const notebookUrl = useMemo(() => {
    return findTopicNotebookUrl(stats?.editalData, activeSubject, activeTopic);
  }, [stats?.editalData, activeSubject, activeTopic]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const displayMs =
    timerState.mode === 'timer' && timerState.targetDurationMs > 0
      ? Math.max(0, timerState.targetDurationMs - timerState.elapsedMs)
      : timerState.elapsedMs;

  const timerProgress =
    timerState.mode === 'timer' && timerState.targetDurationMs > 0
      ? Math.min(100, (timerState.elapsedMs / timerState.targetDurationMs) * 100)
      : 100;

  const handleSave = () => {
    const studiedMs = Math.max(0, timerState.elapsedMs);
    resetGlobalTimer();
    onSaveAndClose(studiedMs, activeSubject, activeTopic);
  };

  return (
    <div
      className={`fixed top-0 right-0 bottom-14 ${
        isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
      } bg-[#f8fafc] dark:bg-[#0b1320] z-40 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fadeIn`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Planejamento', onClick: onClose },
              ...(activeSubject ? [{ label: activeSubject, onClick: onClose }] : []),
              { label: 'Modo Foco (Cronômetro)' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft size={14} />
            Minimizar / Voltar
          </button>
        </div>

        <div className="w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Modo Foco • Cronômetro Sincronizado
                </h2>
                <p className="text-xs text-slate-400">
                  Sincronizado em tempo real com a barra inferior • O tempo estudado vai direto para o Registro
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#0b1320] p-1">
                <button
                  type="button"
                  onClick={() => setGlobalTimerMode('cronometro')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    timerState.mode === 'cronometro'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Cronômetro Progressivo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGlobalTimerMode('timer', targetDuration > 0 ? targetDuration : 45)
                  }
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    timerState.mode === 'timer'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Timer Regressivo
                </button>
              </div>

              {notebookUrl && (
                <a
                  href={notebookUrl.startsWith('http') ? notebookUrl : `https://${notebookUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Caderno de Questões
                </a>
              )}
            </div>

            {/* Banner Somente-Leitura da Sessão Atual (Sem troca de disciplina/tópico no meio do estudo) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/80 dark:border-[#1f304a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm"
                  style={{ backgroundColor: timerState.subjectColor || '#10b981' }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Sessão em Andamento
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {activeSubject}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {activeTopic}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 sm:text-right max-w-[230px]">
                Caso precise alterar a disciplina ou o tópico, ajuste ao finalizar no Registro de Estudo.
              </span>
            </div>

            {/* Giant Clock Display */}
            <div className="py-10 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/80 dark:border-[#1f304a] text-center relative overflow-hidden">
              <div className="text-6xl sm:text-7xl font-mono font-extrabold tracking-wider text-emerald-500">
                {formatTime(displayMs)}
              </div>

              {timerState.mode === 'timer' && timerState.elapsedMs > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Tempo líquido estudado nesta sessão:{' '}
                  <strong className="text-emerald-500">
                    {formatTime(timerState.elapsedMs)}
                  </strong>
                </p>
              )}

              {/* Contador de Tempo em Pausa */}
              {!timerState.isRunning && timerState.hasStarted && timerState.elapsedMs > 0 && (
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Tempo em pausa: {formatTime(timerState.pausedMs)}
                </div>
              )}

              {timerState.mode === 'timer' && (
                <div className="w-full h-1.5 bg-slate-200 dark:bg-[#1a2942] absolute bottom-0 left-0">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={toggleGlobalTimer}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                  timerState.isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
              >
                {timerState.isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    {timerState.hasStarted && timerState.elapsedMs > 0 ? 'Retomar' : 'Iniciar'}
                  </>
                )}
              </button>

              {timerState.elapsedMs > 0 && (
                <button
                  type="button"
                  onClick={resetGlobalTimer}
                  className="p-3 rounded-xl bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors"
                  title="Zerar cronômetro"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finalizar e Registrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopwatchModal;
