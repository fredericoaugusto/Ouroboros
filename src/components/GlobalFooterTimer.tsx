'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Headphones,
  Volume2,
  VolumeX,
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

  // Estados de Som de Foco (Web Audio API) e Alerta de 5 minutos
  const [focusSound, setFocusSound] = useState<'off' | 'brown' | 'pink' | 'rain' | 'gamma40' | 'alpha10'>('off');
  const [soundVolumePct, setSoundVolumePct] = useState<number>(15); // 1% a 100%, de 1 em 1%
  const [voiceAlertEnabled, setVoiceAlertEnabled] = useState<boolean>(true);
  const [isSoundMenuOpen, setIsSoundMenuOpen] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const alerted5MinRef = useRef<boolean>(false);

  // Curva logarítmica/quadrática suave: 1% a 15% fica um sussurro bem baixinho de fundo,
  // e mesmo em 100% nunca fica estourado nos fones de ouvido.
  const computeAudioGain = (pct: number) => {
    const norm = Math.max(0.01, Math.min(1, pct / 100));
    return Math.pow(norm, 1.85) * 0.14;
  };

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

  // Gerador de Ruído de Foco 100% nativo via Web Audio API (sem arquivos externos)
  useEffect(() => {
    const stopCurrentAudio = () => {
      try {
        sourceNodeRef.current?.stop();
        sourceNodeRef.current?.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    };

    if (focusSound === 'off') {
      stopCurrentAudio();
      return;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    stopCurrentAudio();

    const bufferSize = ctx.sampleRate * 4; // 4 segundos em loop contínuo
    const isBinaural = focusSound === 'gamma40' || focusSound === 'alpha10';
    const buffer = ctx.createBuffer(isBinaural ? 2 : 1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (focusSound === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.2;
      }
    } else if (focusSound === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    } else if (focusSound === 'rain') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.06 * white) / 1.06;
        const drop = Math.random() > 0.997 ? (Math.random() * 0.4) : 0;
        output[i] = lastOut * 2.2 + drop;
      }
    } else if (focusSound === 'gamma40' || focusSound === 'alpha10') {
      // Batida Binaural Estéreo (requer fones) combinada com tapete aveludado de Ruído Marrom
      // Gama 40Hz (200Hz L / 240Hz R): Foco cognitivo intenso e memória de trabalho
      // Alfa 10Hz (200Hz L / 210Hz R): Calma alerta e leitura fluida sem ansiedade
      const outL = buffer.getChannelData(0);
      const outR = buffer.getChannelData(1);
      const baseFreq = 200;
      const beatFreq = focusSound === 'gamma40' ? 40 : 10;
      let lastBrownL = 0.0;
      let lastBrownR = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const wL = Math.random() * 2 - 1;
        const wR = Math.random() * 2 - 1;
        lastBrownL = (lastBrownL + 0.02 * wL) / 1.02;
        lastBrownR = (lastBrownR + 0.02 * wR) / 1.02;
        const sineL = Math.sin(2 * Math.PI * baseFreq * t) * 0.35;
        const sineR = Math.sin(2 * Math.PI * (baseFreq + beatFreq) * t) * 0.35;
        outL[i] = sineL + lastBrownL * 1.4;
        outR[i] = sineR + lastBrownR * 1.4;
      }
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.value = computeAudioGain(soundVolumePct);
    gainNodeRef.current = gainNode;

    noiseSource.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseSource.start(0);
    sourceNodeRef.current = noiseSource;

    return () => {
      stopCurrentAudio();
    };
  }, [focusSound]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = computeAudioGain(soundVolumePct);
    }
  }, [soundVolumePct]);

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

  // Atualiza o título da aba do navegador (Brave/Chrome) com o cronômetro ao vivo e dispara aviso de 5 minutos
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (timerState.hasStarted && timerState.elapsedMs > 0) {
      const prefix = timerState.isRunning ? '⏱' : '⏸';
      const timeFormatted = formatTimeMs(displayMs);
      const shortSubj =
        currentSubjectName && currentSubjectName !== 'Selecione uma matéria'
          ? ` • ${currentSubjectName}`
          : '';
      document.title = `(${timeFormatted}) ${prefix} Krono${shortSubj}`;
    } else {
      document.title = 'Krono • Ciclos & Estudos';
      alerted5MinRef.current = false;
    }

    // Alerta de voz/som quando faltam exatamente 5 minutos (300 segundos) no modo regressivo
    if (
      voiceAlertEnabled &&
      timerState.isRunning &&
      timerState.mode === 'timer' &&
      timerState.targetDurationMs >= 10 * 60 * 1000
    ) {
      const remainingSec = Math.floor(
        Math.max(0, timerState.targetDurationMs - timerState.elapsedMs) / 1000
      );
      if (remainingSec <= 300 && remainingSec >= 295 && !alerted5MinRef.current) {
        alerted5MinRef.current = true;
        try {
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(
              `Atenção: faltam cinco minutos para concluir o bloco de ${currentSubjectName}.`
            );
            utter.lang = 'pt-BR';
            utter.rate = 1.05;
            window.speechSynthesis.speak(utter);
          }
        } catch {}
      }
    }
  }, [
    timerState.hasStarted,
    timerState.isRunning,
    timerState.elapsedMs,
    timerState.mode,
    timerState.targetDurationMs,
    displayMs,
    currentSubjectName,
    voiceAlertEnabled,
  ]);

  if (['/login', '/register'].includes(pathname)) {
    return null;
  }

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

            {/* Menu de Som de Foco (Ruído Marrom/Rosa/Chuva) & Alerta de Voz */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSoundMenuOpen((v) => !v)}
                className={`p-2 rounded-xl border transition-colors flex items-center gap-1 text-xs font-bold ${
                  focusSound !== 'off'
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-500'
                    : 'bg-slate-100 dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-300 hover:text-indigo-400'
                }`}
                title="Som de Foco (Ruído Marrom, Rosa, Chuva) e Alerta de 5 min"
              >
                <Headphones size={15} />
              </button>

              {isSoundMenuOpen && (
                <div className="absolute bottom-12 right-0 w-64 p-3.5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-2xl space-y-3 z-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      🎧 Som de Foco & Alertas
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSoundMenuOpen(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'off', label: '🔇 Desligado' },
                      { id: 'brown', label: '🤎 Ruído Marrom' },
                      { id: 'pink', label: '🌸 Ruído Rosa' },
                      { id: 'rain', label: '🌧️ Chuva Suave' },
                      { id: 'gamma40', label: '🧠 Binaural 40Hz (Gama)' },
                      { id: 'alpha10', label: '🌊 Binaural 10Hz (Alfa)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFocusSound(opt.id as any)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-left border transition-all ${
                          focusSound === opt.id
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'bg-slate-50 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {focusSound !== 'off' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Volume2 size={12} /> Volume Suave
                        </span>
                        <span className="font-mono font-bold text-indigo-400">{soundVolumePct}%</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={soundVolumePct}
                        onChange={(e) => setSoundVolumePct(parseInt(e.target.value, 10) || 1)}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <label className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#1f304a] cursor-pointer">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      🗣️ Avisar por voz faltando 5 min
                    </span>
                    <input
                      type="checkbox"
                      checked={voiceAlertEnabled}
                      onChange={(e) => setVoiceAlertEnabled(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                  </label>
                </div>
              )}
            </div>

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
