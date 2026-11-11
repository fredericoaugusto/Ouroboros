'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import Breadcrumbs from './Breadcrumbs';
import { Play, Pause, RotateCcw, CheckCircle2, Sparkles, ArrowLeft, Timer } from 'lucide-react';

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
  const {
    studyPlans,
    selectedDataFile,
    availablePlans,
    getRecommendedSession,
    studyCycle,
    sessionProgressMap,
  } = useData();

  const [mode, setMode] = useState<'cronometro' | 'timer'>(
    targetDuration > 0 ? 'timer' : 'cronometro'
  );
  const [time, setTime] = useState(0); // ms
  const [pausedMs, setPausedMs] = useState(0); // ms em pausa
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [initialTimerTime, setInitialTimerTime] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || '');
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || '');

  const currentPlan = useMemo(() => {
    const planIndex = availablePlans.indexOf(selectedDataFile);
    return planIndex >= 0 ? studyPlans[planIndex] : studyPlans?.[0];
  }, [studyPlans, selectedDataFile, availablePlans]);

  const subjects = useMemo(() => {
    if (!currentPlan || !currentPlan.subjects) return [];
    return currentPlan.subjects.map((s: any) => s.subject);
  }, [currentPlan]);

  const topics = useMemo(() => {
    if (!selectedSubject || !currentPlan || !currentPlan.subjects) return [];
    const subjectData = currentPlan.subjects.find((s: any) => s.subject === selectedSubject);
    return subjectData ? subjectData.topics || [] : [];
  }, [selectedSubject, currentPlan]);

  useEffect(() => {
    if (isOpen) {
      if (initialSubject) setSelectedSubject(initialSubject);
      if (initialTopic) setSelectedTopic(initialTopic);
      if (targetDuration > 0) {
        setMode('timer');
        const ms = targetDuration * 60 * 1000;
        setTime(ms);
        setInitialTimerTime(ms);
      } else {
        setMode('cronometro');
        setTime(0);
        setInitialTimerTime(0);
      }
      setPausedMs(0);
      setHasStarted(false);
      setIsRunning(false);
    }
  }, [isOpen, initialSubject, initialTopic, targetDuration]);

  // Cronômetro Principal
  useEffect(() => {
    if (!isOpen || !isRunning) return;

    const interval = setInterval(() => {
      setTime((prev) => {
        if (mode === 'timer') {
          if (prev <= 1000) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1000;
        } else {
          return prev + 1000;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isRunning, mode]);

  // Cronômetro de Pausa
  useEffect(() => {
    if (!isOpen || isRunning || !hasStarted) return;

    const pauseInterval = setInterval(() => {
      setPausedMs((prev) => prev + 1000);
    }, 1000);

    return () => clearInterval(pauseInterval);
  }, [isOpen, isRunning, hasStarted]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  };

  const handleSave = () => {
    setIsRunning(false);
    const elapsedMs =
      mode === 'timer' ? Math.max(0, initialTimerTime - time) : Math.max(0, time);
    onSaveAndClose(elapsedMs, selectedSubject, selectedTopic);
  };

  const handleSuggestNext = () => {
    if (!studyCycle) return;
    const nextSession = studyCycle.find((session) => {
      const progress = sessionProgressMap[session.id as string] || 0;
      return progress < session.duration;
    });
    if (nextSession) {
      const remainingMin = Math.max(
        1,
        Math.round(nextSession.duration - (sessionProgressMap[nextSession.id as string] || 0))
      );
      const { recommendedTopic } = getRecommendedSession({
        forceSubject: nextSession.subject,
      });
      setSelectedSubject(nextSession.subject);
      if (recommendedTopic) {
        setSelectedTopic(recommendedTopic.topic);
      }
      setMode('timer');
      const ms = remainingMin * 60 * 1000;
      setTime(ms);
      setInitialTimerTime(ms);
      setPausedMs(0);
      setHasStarted(false);
    }
  };

  const flattenTopics = (list: any[], prefix = ''): string[] => {
    let res: string[] = [];
    for (const t of list || []) {
      const label = prefix ? `${prefix} › ${t.topic_text}` : t.topic_text;
      res.push(t.topic_text);
      if (t.sub_topics && t.sub_topics.length > 0) {
        res = res.concat(flattenTopics(t.sub_topics, label));
      }
    }
    return res;
  };

  const flatTopicOptions = useMemo(() => flattenTopics(topics), [topics]);

  if (!isOpen) return null;

  const timerProgress =
    mode === 'timer' && initialTimerTime > 0
      ? Math.min(100, ((initialTimerTime - time) / initialTimerTime) * 100)
      : 100;

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-40 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Planejamento', onClick: onClose },
              ...(selectedSubject ? [{ label: selectedSubject, onClick: onClose }] : []),
              { label: 'Modo Foco (Cronômetro)' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
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
                  Modo Foco • Cronômetro de Estudo
                </h2>
                <p className="text-xs text-slate-400">
                  O tempo exato estudado será enviado automaticamente para o Registro de Estudo
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
                  onClick={() => {
                    setIsRunning(false);
                    setHasStarted(false);
                    setPausedMs(0);
                    setMode('cronometro');
                    setTime(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'cronometro'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Cronômetro Progressivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRunning(false);
                    setHasStarted(false);
                    setPausedMs(0);
                    setMode('timer');
                    const ms = (targetDuration > 0 ? targetDuration : 45) * 60 * 1000;
                    setTime(ms);
                    setInitialTimerTime(ms);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    mode === 'timer'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Timer Regressivo
                </button>
              </div>

              <button
                type="button"
                onClick={handleSuggestNext}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sincronizar com Próximo Bloco
              </button>
            </div>

            {/* Subject & Topic Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Disciplina
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setSelectedTopic('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">Selecione a disciplina...</option>
                  {subjects.map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Tópico / Assunto
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={!selectedSubject}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs font-semibold text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="">Selecione o tópico...</option>
                  {flatTopicOptions.map((t, i) => (
                    <option key={`${t}-${i}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Giant Clock Display */}
            <div className="py-10 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/80 dark:border-[#1f304a] text-center relative overflow-hidden">
              <div className="text-6xl sm:text-7xl font-mono font-extrabold tracking-wider text-emerald-500">
                {formatTime(time)}
              </div>
              {selectedTopic && (
                <p className="text-xs text-slate-400 mt-2 px-4 truncate">
                  Estudando:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{selectedTopic}</strong>
                </p>
              )}

              {/* Contador de Tempo em Pausa */}
              {!isRunning && hasStarted && (
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Tempo em pausa: {formatTime(pausedMs)}
                </div>
              )}

              {mode === 'timer' && (
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
                onClick={() => {
                  setHasStarted(true);
                  setIsRunning(!isRunning);
                }}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    {hasStarted ? 'Retomar' : 'Iniciar'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRunning(false);
                  setHasStarted(false);
                  setPausedMs(0);
                  setTime(mode === 'timer' ? initialTimerTime : 0);
                }}
                className="p-3 rounded-xl bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors"
                title="Reiniciar"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

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
