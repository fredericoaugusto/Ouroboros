'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useData } from '../context/DataContext';
import { Play, Pause, RotateCcw, CheckCircle2, BookOpen, Clock } from 'lucide-react';

export default function GlobalFooterTimer() {
  const pathname = usePathname();
  const {
    currentStudySession,
    setIsRegisterModalOpen,
    setInitialStudyRecord,
    stats,
    studyCycle,
    studyRecords,
  } = useData();

  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const currentSubjectName =
    currentStudySession?.subject || studyCycle?.[0]?.subject || 'Selecione uma matéria';
  const currentSubjectColor =
    currentStudySession?.color || studyCycle?.[0]?.color || '#10b981';

  // Encontra o próximo tópico sugerido do edital para a matéria atual
  const suggestedTopic = useMemo(() => {
    if (!currentSubjectName || currentSubjectName === 'Selecione uma matéria') return '';
    const subjData = stats?.editalData?.find(s => s.subject === currentSubjectName);
    if (!subjData || !subjData.topics) return '';

    const completedSet = new Set(
      (studyRecords || [])
        .filter(r => r.subject === currentSubjectName && r.teoriaFinalizada)
        .map(r => r.topic)
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

  // Calcula o tempo estudado hoje a partir dos registros do dia
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMs = (studyRecords || [])
    .filter(r => r.date && r.date.startsWith(todayStr))
    .reduce((acc, r) => acc + (r.studyTime || 0), 0);
  const todayTotalStudyMinutes = Math.round(todayMs / 60000);
  const todayHours = Math.floor(todayTotalStudyMinutes / 60);
  const todayMins = todayTotalStudyMinutes % 60;

  const handleToggleTimer = () => {
    setIsRunning(prev => !prev);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setSeconds(0);
  };

  const handleOpenRegister = () => {
    setIsRunning(false);
    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subject: currentSubjectName !== 'Selecione uma matéria' ? currentSubjectName : '',
        topic: suggestedTopic || '',
        studyTime: seconds > 0 ? seconds * 1000 : 45 * 60 * 1000,
        date: new Date().toISOString().split('T')[0],
      });
    }
    setIsRegisterModalOpen(true);
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1421]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1a293e] px-4 py-2.5 shadow-lg transition-all duration-200">
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
            <span className="text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase block">
              Pelo Planejamento
            </span>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {currentSubjectName}
            </p>
          </div>
        </div>

        {/* Centro: Relógio e Controles */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="font-mono text-lg sm:text-2xl font-bold tracking-wider text-slate-900 dark:text-emerald-400 bg-slate-100 dark:bg-[#131f33] px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1f304a] shadow-inner">
            {formatTime(seconds)}
          </div>

          <button
            onClick={handleToggleTimer}
            className={`p-2.5 rounded-full transition-all shadow-md flex items-center justify-center ${
              isRunning
                ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
            }`}
            title={isRunning ? 'Pausar' : 'Iniciar'}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
          </button>

          {seconds > 0 && (
            <button
              onClick={handleResetTimer}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title="Zerar cronômetro"
            >
              <RotateCcw size={16} />
            </button>
          )}

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
              {todayHours}h{todayMins > 0 ? `${todayMins}m` : ''}
            </strong>
          </span>
        </div>
      </div>
    </footer>
  );
}
