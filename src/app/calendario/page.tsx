'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useData, StudySession } from '../../context/DataContext';
import { useNotification } from '../../context/NotificationContext';
import TopicQueueSelectorModal, {
  getSubjectTopicOverride,
  setSubjectTopicOverride,
} from '../../components/TopicQueueSelectorModal';
import { startGlobalTimerSession } from '../../lib/timerStore';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Shuffle,
  GripVertical,
  Play,
  Plus,
  CheckCircle2,
  Pencil,
  Info,
  Target,
  Layers,
} from 'lucide-react';

const WEEKDAY_LABELS = [
  { key: 'Dom', full: 'Domingo', idx: 0 },
  { key: 'Seg', full: 'Segunda', idx: 1 },
  { key: 'Ter', full: 'Terça', idx: 2 },
  { key: 'Qua', full: 'Quarta', idx: 3 },
  { key: 'Qui', full: 'Quinta', idx: 4 },
  { key: 'Sex', full: 'Sexta', idx: 5 },
  { key: 'Sáb', full: 'Sábado', idx: 6 },
];

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface ProjectedCard {
  uid: string;
  cycleIndex: number; // Índice real dentro do studyCycle para permitir reordenação direta
  session: StudySession;
  subject: string;
  color: string;
  durationMinutes: number;
  questionsTarget?: number;
  suggestedTopic: string;
  isCompleted: boolean;
  isHistoryRecord?: boolean;
}

export default function CalendarioPage() {
  const {
    studyCycle,
    setStudyCycle,
    sessionProgressMap,
    studyRecords,
    stats,
    setCurrentStudySession,
    setIsStopwatchModalOpen,
    setStopwatchTargetDuration,
    setStopwatchModalSubject,
    setIsRegisterModalOpen,
  } = useData();
  const { showNotification } = useNotification();

  // Offset de semanas em relação à semana atual (0 = esta semana, +1 = próxima, -1 = anterior)
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Modo "Replanejar / Reorganizar" (ativa drag-and-drop estilo Kanban entre blocos e dias)
  const [isReplanningMode, setIsReplanningMode] = useState<boolean>(false);

  // Quantidade padrão de blocos por dia para projetar ciclos contínuos (por blocos ou por questões)
  const [blocksPerDay, setBlocksPerDay] = useState<number>(4);

  // Modal de escolha manual de tópico para uma disciplina
  const [topicModalSubject, setTopicModalSubject] = useState<string | null>(null);
  const [topicOverrideTick, setTopicOverrideTick] = useState<number>(0);

  // Estado de Drag & Drop
  const [draggedCard, setDraggedCard] = useState<{
    cycleIndex: number;
    dayKey: string;
    subject: string;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('krono_calendar_blocks_per_day');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
          setBlocksPerDay(parsed);
        }
      }
    }
  }, []);

  const handleBlocksPerDayChange = (val: number) => {
    const clamped = Math.max(1, Math.min(12, val));
    setBlocksPerDay(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('krono_calendar_blocks_per_day', String(clamped));
    }
  };

  // Detecta se o ciclo atual é um Quadro Semanal Fixo (possui dayOfWeek nas sessões)
  const isFixedWeeklyCycle = useMemo(() => {
    return Boolean(studyCycle && studyCycle.some((s) => Boolean(s.dayOfWeek)));
  }, [studyCycle]);

  // Mapa de fila de tópicos pendentes por disciplina (na ordem exata do edital)
  const subjectPendingTopicsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!stats?.editalData) return map;

    const completedSetBySubject = new Map<string, Set<string>>();
    for (const rec of studyRecords || []) {
      if (rec.teoriaFinalizada && rec.subject && rec.topic) {
        const key = rec.subject.trim().toLowerCase();
        if (!completedSetBySubject.has(key)) {
          completedSetBySubject.set(key, new Set());
        }
        completedSetBySubject.get(key)!.add(rec.topic);
      }
    }

    for (const subj of stats.editalData) {
      const sKey = (subj.subject || '').trim().toLowerCase();
      const doneTopics = completedSetBySubject.get(sKey) || new Set<string>();
      const queue: string[] = [];

      const collectPending = (topics: any[]) => {
        for (const t of topics || []) {
          if (t.sub_topics && t.sub_topics.length > 0) {
            collectPending(t.sub_topics);
          } else if (!t.is_completed && !doneTopics.has(t.topic_text)) {
            queue.push(t.topic_text);
          }
        }
      };

      collectPending(subj.topics || []);

      // Se o aluno escolheu manualmente um tópico prioritário para esta matéria, coloca no topo da fila
      const manualTopic = getSubjectTopicOverride(subj.subject);
      if (manualTopic) {
        const filtered = queue.filter((t) => t !== manualTopic);
        queue.splice(0, queue.length, manualTopic, ...filtered);
      }

      map.set(sKey, queue);
    }

    return map;
  }, [stats?.editalData, studyRecords, topicOverrideTick]);

  // Calcula os 7 dias da semana exibida (Domingo a Sábado)
  const weekDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentDayOfWeek = now.getDay(); // 0 = Dom .. 6 = Sáb
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDayOfWeek + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const isToday = d.getTime() === now.getTime();
      const isPast = d.getTime() < now.getTime();
      return {
        date: d,
        iso,
        dayNumber: d.getDate(),
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        weekdayKey: WEEKDAY_LABELS[i].key,
        weekdayFull: WEEKDAY_LABELS[i].full,
        isToday,
        isPast,
      };
    });
  }, [weekOffset]);

  // Sessões pendentes na volta atual do ciclo (ordenadas a partir do próximo bloco não concluído)
  const pendingCycleEntries = useMemo(() => {
    if (!studyCycle || studyCycle.length === 0) return [];
    const list: { session: StudySession; cycleIndex: number; remainingMin: number }[] = [];
    studyCycle.forEach((s, idx) => {
      const prog = sessionProgressMap?.[s.id as string] || 0;
      const rem = Math.max(0, Math.round(s.duration - prog));
      if (rem > 0) {
        list.push({ session: s, cycleIndex: idx, remainingMin: rem });
      }
    });
    // Se todos os blocos da volta já foram concluídos, projeta uma nova volta completa
    if (list.length === 0) {
      return studyCycle.map((s, idx) => ({
        session: s,
        cycleIndex: idx,
        remainingMin: s.duration,
      }));
    }
    return list;
  }, [studyCycle, sessionProgressMap]);

  // Projeta os blocos em cada dia da semana selecionada (e nas semanas futuras!)
  const projectedByDayIso = useMemo(() => {
    const result = new Map<string, ProjectedCard[]>();
    if (!studyCycle || studyCycle.length === 0) {
      weekDays.forEach((wd) => result.set(wd.iso, []));
      return result;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Contador de aparições de cada disciplina a partir de hoje para sugerir tópicos sequenciais (Tópico 1, Tópico 2, Tópico 3...)
    const subjectOccurrenceCursor = new Map<string, number>();

    const getNextSuggestedTopicForSubject = (subjectName: string) => {
      const sKey = (subjectName || '').trim().toLowerCase();
      const queue = subjectPendingTopicsMap.get(sKey) || [];
      if (queue.length === 0) return 'Todos os tópicos concluídos (Revisão Geral)';
      const occ = subjectOccurrenceCursor.get(sKey) || 0;
      subjectOccurrenceCursor.set(sKey, occ + 1);
      // Avança na fila de tópicos a cada ~2 blocos da mesma matéria na projeção
      const topicIdx = Math.min(queue.length - 1, Math.floor(occ / 2));
      return queue[topicIdx];
    };

    // Se a semana exibida for futura (weekOffset > 0), avançamos o cursor pelos dias entre hoje e o início da semana exibida
    const firstDisplayedDate = weekDays[0].date;
    const diffDaysFromTodayToStart = Math.round(
      (firstDisplayedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let globalBlockPointer = 0;
    if (!isFixedWeeklyCycle && diffDaysFromTodayToStart > 0) {
      const skippedBlocks = diffDaysFromTodayToStart * blocksPerDay;
      for (let b = 0; b < skippedBlocks; b++) {
        const entry =
          b < pendingCycleEntries.length
            ? pendingCycleEntries[b]
            : {
                session: studyCycle[(b - pendingCycleEntries.length) % studyCycle.length],
                cycleIndex: (b - pendingCycleEntries.length) % studyCycle.length,
                remainingMin:
                  studyCycle[(b - pendingCycleEntries.length) % studyCycle.length].duration,
              };
        getNextSuggestedTopicForSubject(entry.session.subject);
      }
      globalBlockPointer = skippedBlocks;
    }

    for (const wd of weekDays) {
      const dayCards: ProjectedCard[] = [];

      // 1. Nos dias passados (ou hoje), inclui os estudos realmente registrados naquela data
      const recordsOnDay = (studyRecords || []).filter(
        (r) => r.date && r.date.startsWith(wd.iso) && r.countInPlanning !== false
      );

      if (wd.isPast) {
        recordsOnDay.forEach((rec, rIdx) => {
          const mins = Math.max(1, Math.round((rec.studyTime || 0) / 60000));
          const matchingSessionIdx = studyCycle.findIndex(
            (s) => s.subject.toLowerCase() === (rec.subject || '').toLowerCase()
          );
          const color =
            matchingSessionIdx !== -1 ? studyCycle[matchingSessionIdx].color : '#10b981';
          dayCards.push({
            uid: `hist-${wd.iso}-${rIdx}`,
            cycleIndex: matchingSessionIdx !== -1 ? matchingSessionIdx : 0,
            session:
              matchingSessionIdx !== -1
                ? studyCycle[matchingSessionIdx]
                : ({
                    id: `hist-${rIdx}`,
                    subject: rec.subject,
                    duration: mins,
                    color,
                  } as StudySession),
            subject: rec.subject,
            color,
            durationMinutes: mins,
            suggestedTopic: rec.topic || 'Estudo registrado',
            isCompleted: true,
            isHistoryRecord: true,
          });
        });
        result.set(wd.iso, dayCards);
        continue;
      }

      // 2. Hoje ou Dias Futuros:
      if (isFixedWeeklyCycle) {
        // Quadro Semanal Fixo: filtra blocos cujo dayOfWeek bate com o dia da coluna
        studyCycle.forEach((session, cycleIdx) => {
          if (session.dayOfWeek === wd.weekdayKey) {
            const prog = sessionProgressMap?.[session.id as string] || 0;
            const isCompletedToday = wd.isToday && prog >= session.duration;
            dayCards.push({
              uid: `fixed-${wd.iso}-${session.id}-${cycleIdx}`,
              cycleIndex: cycleIdx,
              session,
              subject: session.subject,
              color: session.color || '#10b981',
              durationMinutes: session.duration,
              questionsTarget: session.questionsTarget,
              suggestedTopic: getNextSuggestedTopicForSubject(session.subject),
              isCompleted: isCompletedToday,
            });
          }
        });
      } else {
        // Ciclo por Blocos (Tempo ou Questões):
        // Se for Hoje, mostra primeiro os registros já concluídos hoje e completa a meta diária com os próximos blocos da fila!
        recordsOnDay.forEach((rec, rIdx) => {
          const mins = Math.max(1, Math.round((rec.studyTime || 0) / 60000));
          const matchingSessionIdx = studyCycle.findIndex(
            (s) => s.subject.toLowerCase() === (rec.subject || '').toLowerCase()
          );
          const color =
            matchingSessionIdx !== -1 ? studyCycle[matchingSessionIdx].color : '#10b981';
          dayCards.push({
            uid: `today-done-${wd.iso}-${rIdx}`,
            cycleIndex: matchingSessionIdx !== -1 ? matchingSessionIdx : 0,
            session:
              matchingSessionIdx !== -1
                ? studyCycle[matchingSessionIdx]
                : ({
                    id: `hist-${rIdx}`,
                    subject: rec.subject,
                    duration: mins,
                    color,
                  } as StudySession),
            subject: rec.subject,
            color,
            durationMinutes: mins,
            suggestedTopic: rec.topic || 'Concluído hoje',
            isCompleted: true,
            isHistoryRecord: true,
          });
        });

        const remainingSlotsToday = wd.isToday
          ? Math.max(1, blocksPerDay - recordsOnDay.length)
          : blocksPerDay;

        for (let slot = 0; slot < remainingSlotsToday; slot++) {
          const ptr = globalBlockPointer++;
          const entry =
            ptr < pendingCycleEntries.length
              ? pendingCycleEntries[ptr]
              : {
                  session:
                    studyCycle[(ptr - pendingCycleEntries.length) % studyCycle.length],
                  cycleIndex: (ptr - pendingCycleEntries.length) % studyCycle.length,
                  remainingMin:
                    studyCycle[(ptr - pendingCycleEntries.length) % studyCycle.length]
                      .duration,
                };

          dayCards.push({
            uid: `proj-${wd.iso}-${slot}-${entry.session.id}-${entry.cycleIndex}`,
            cycleIndex: entry.cycleIndex,
            session: entry.session,
            subject: entry.session.subject,
            color: entry.session.color || '#10b981',
            durationMinutes: entry.remainingMin,
            questionsTarget: entry.session.questionsTarget,
            suggestedTopic: getNextSuggestedTopicForSubject(entry.session.subject),
            isCompleted: false,
          });
        }
      }

      result.set(wd.iso, dayCards);
    }

    return result;
  }, [
    studyCycle,
    weekDays,
    isFixedWeeklyCycle,
    blocksPerDay,
    pendingCycleEntries,
    studyRecords,
    sessionProgressMap,
    subjectPendingTopicsMap,
  ]);

  // Previsão Adaptativa de Término do Edital & Métricas da Semana
  const weekAndEditalSummary = useMemo(() => {
    let plannedWeekMinutes = 0;
    let completedWeekMinutes = 0;

    for (const wd of weekDays) {
      const cards = projectedByDayIso.get(wd.iso) || [];
      for (const c of cards) {
        plannedWeekMinutes += c.durationMinutes;
        if (c.isCompleted) {
          completedWeekMinutes += c.durationMinutes;
        }
      }
    }

    let totalPendingTopics = 0;
    subjectPendingTopicsMap.forEach((q) => {
      totalPendingTopics += q.length;
    });

    // Estimativa adaptativa: ~1 tópico concluído a cada 1.8 blocos estudados
    const effectiveDailyBlocks = isFixedWeeklyCycle
      ? Math.max(1, (studyCycle?.length || 7) / 7)
      : blocksPerDay;
    const estimatedDaysToFinish = Math.ceil(
      (totalPendingTopics * 1.8) / Math.max(1, effectiveDailyBlocks)
    );
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + estimatedDaysToFinish);

    const pctWeek =
      plannedWeekMinutes > 0
        ? Math.min(100, Math.round((completedWeekMinutes / plannedWeekMinutes) * 100))
        : 0;

    return {
      plannedWeekMinutes,
      completedWeekMinutes,
      pctWeek,
      totalPendingTopics,
      estimatedDaysToFinish,
      finishDateFormatted: finishDate.toLocaleDateString('pt-BR'),
    };
  }, [
    weekDays,
    projectedByDayIso,
    subjectPendingTopicsMap,
    isFixedWeeklyCycle,
    studyCycle,
    blocksPerDay,
  ]);

  // Handler de Drag & Drop para reorganizar blocos (Ex: mover C de Hoje para Amanhã entre E e F -> E C F G H)
  const handleDropOnCardOrDay = (
    targetCycleIndex: number,
    targetWeekdayKey: string
  ) => {
    if (!draggedCard || !studyCycle) return;
    const fromIdx = draggedCard.cycleIndex;
    const toIdx = targetCycleIndex;

    if (fromIdx === toIdx && (!isFixedWeeklyCycle || draggedCard.dayKey === targetWeekdayKey)) {
      setDraggedCard(null);
      setDragOverTarget(null);
      return;
    }

    const updated = [...studyCycle];
    const [movedItem] = updated.splice(fromIdx, 1);
    if (!movedItem) return;

    // Se for Quadro Semanal Fixo, atualiza também o dia da semana do bloco arrastado
    const finalMovedItem: StudySession = isFixedWeeklyCycle
      ? { ...movedItem, dayOfWeek: targetWeekdayKey }
      : movedItem;

    const insertAt = Math.max(0, Math.min(updated.length, toIdx));
    updated.splice(insertAt, 0, finalMovedItem);

    setStudyCycle(updated);
    setDraggedCard(null);
    setDragOverTarget(null);
    showNotification(
      `Bloco "${movedItem.subject}" reposicionado! O Ciclo de Planejamento e o Próximo Estudo da Home foram atualizados.`,
      'success'
    );
  };

  const handleStartBlockStudy = (card: ProjectedCard) => {
    setCurrentStudySession(card.session);
    setStopwatchModalSubject(card.subject);
    setStopwatchTargetDuration(card.durationMinutes);
    startGlobalTimerSession({
      subject: card.subject,
      topic: card.suggestedTopic,
      subjectColor: card.color,
      targetDurationMinutes: card.durationMinutes,
      autoStart: true,
    });
    setIsStopwatchModalOpen(true);
  };

  const formatHoursMins = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}min`;
    return `${h}h${String(m).padStart(2, '0')}min`;
  };

  const headerMonthLabel = `${MONTH_NAMES[weekDays[0].monthIdx]}, ${weekDays[0].year}`;
  const headerRangeLabel = `${String(weekDays[0].dayNumber).padStart(2, '0')}/${String(
    weekDays[0].monthIdx + 1
  ).padStart(2, '0')} – ${String(weekDays[6].dayNumber).padStart(2, '0')}/${String(
    weekDays[6].monthIdx + 1
  ).padStart(2, '0')}`;

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-16">
      {/* Top Title & Info Banner (Estilo Estudei) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-emerald-500" />
            Calendário Adaptativo do Ciclo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Projeção inteligente dos seus blocos e tópicos do edital sincronizada em tempo real com a aba Planejamento e Home
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/planejamento"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <Layers size={14} className="text-emerald-500" />
            Ver Rosca do Ciclo
          </Link>

          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all"
          >
            <Plus size={15} />
            Adicionar Estudo
          </button>
        </div>
      </div>

      {/* Explanatory Adaptive Banner */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-200">
        <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">
          O <strong>Krono</strong> indica o próximo tópico de cada disciplina na ordem do seu edital e projeta as semanas seguintes a partir do seu ritmo.{' '}
          <strong>Conforme você estuda mais ou menos blocos no dia, o calendário inteiro e a data de término do edital se reajustam automaticamente.</strong>{' '}
          Clique em <strong>“🔀 Replanejar”</strong> à direita para arrastar qualquer bloco entre dias (ex: mover o bloco C de hoje para amanhã entre E e F transforma amanhã em <code>E, C, F, G, H</code> e atualiza a ordem oficial do seu ciclo!).
        </div>
      </div>

      {/* Calendar Control Bar (Month, Week Navigation, Weekly Progress, Daily Rhythm & "Replanejar" Toggle) */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left: Month & Week Arrows */}
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
              {headerMonthLabel}
            </h2>
            <span className="text-xs font-semibold text-slate-400">{headerRangeLabel}</span>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#0b1320] hover:bg-emerald-500/20 text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors"
              title="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                weekOffset === 0
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                  : 'bg-slate-100 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#0b1320] hover:bg-emerald-500/20 text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors"
              title="Próxima semana"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Center: Week Completion & Adaptive Edital Completion Forecast */}
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 flex items-center justify-center text-[10px] font-extrabold text-emerald-500">
              {weekAndEditalSummary.pctWeek}%
            </div>
            <div className="text-xs">
              <strong className="text-slate-800 dark:text-white block">
                {weekAndEditalSummary.pctWeek}% da semana
              </strong>
              <span className="text-[11px] text-slate-400">
                {formatHoursMins(weekAndEditalSummary.completedWeekMinutes)} /{' '}
                {formatHoursMins(weekAndEditalSummary.plannedWeekMinutes)}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-[#1f304a] text-xs">
            <Target className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Previsão Adaptativa do Edital
              </span>
              <strong className="text-slate-800 dark:text-slate-100">
                {weekAndEditalSummary.totalPendingTopics > 0
                  ? `${weekAndEditalSummary.finishDateFormatted} (${weekAndEditalSummary.totalPendingTopics} tópicos restantes)`
                  : 'Edital 100% finalizado!'}
              </strong>
            </div>
          </div>
        </div>

        {/* Right: Daily Blocks Capacity (if block cycle) & "🔀 Replanejar" Button */}
        <div className="flex items-center gap-2.5">
          {!isFixedWeeklyCycle && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0b1320] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1f304a]">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Ritmo:
              </span>
              <select
                value={blocksPerDay}
                onChange={(e) => handleBlocksPerDayChange(Number(e.target.value))}
                className="bg-transparent text-xs font-extrabold text-emerald-500 focus:outline-none cursor-pointer"
                title="Quantos blocos do ciclo você costuma estudar por dia"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n} className="bg-slate-900 text-white">
                    {n} {n === 1 ? 'bloco/dia' : 'blocos/dia'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setIsReplanningMode((v) => !v);
              if (!isReplanningMode) {
                showNotification(
                  'Modo Replanejar ativado! Arraste qualquer bloco para outro dia ou posição na coluna.',
                  'info'
                );
              }
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border transition-all ${
              isReplanningMode
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20 ring-2 ring-amber-300'
                : 'bg-white dark:bg-[#0b1320] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#1f304a] hover:border-emerald-500/50'
            }`}
          >
            <Shuffle size={14} />
            {isReplanningMode ? 'Concluir Reorganização' : 'Replanejar'}
          </button>
        </div>
      </div>

      {/* Empty Cycle State */}
      {(!studyCycle || studyCycle.length === 0) ? (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] p-12 text-center space-y-4">
          <CalendarIcon className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Nenhum ciclo ativo para projetar no calendário
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Crie seu Ciclo de Estudos (por Tempo, por Questões ou Semanal Fixo) na aba Planejamento para visualizar sua agenda adaptativa completa aqui.
          </p>
          <Link
            href="/planejamento"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
          >
            Ir para Planejamento
          </Link>
        </div>
      ) : (
        /* 7-Column Weekly Grid (Dom .. Sáb) matching Estudei Layout */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start">
          {weekDays.map((wd) => {
            const cards = projectedByDayIso.get(wd.iso) || [];
            const dayPlannedMin = cards.reduce((acc, c) => acc + c.durationMinutes, 0);
            const dayDoneMin = cards
              .filter((c) => c.isCompleted)
              .reduce((acc, c) => acc + c.durationMinutes, 0);

            return (
              <div
                key={wd.iso}
                onDragOver={(e) => {
                  if (!isReplanningMode) return;
                  e.preventDefault();
                  setDragOverTarget(`col-${wd.iso}`);
                }}
                onDrop={(e) => {
                  if (!isReplanningMode) return;
                  e.preventDefault();
                  const lastCard = cards[cards.length - 1];
                  const targetIdx = lastCard
                    ? lastCard.cycleIndex
                    : studyCycle.length - 1;
                  handleDropOnCardOrDay(targetIdx, wd.weekdayKey);
                }}
                className={`rounded-2xl border flex flex-col min-h-[520px] transition-all ${
                  wd.isToday
                    ? 'bg-emerald-500/[0.04] dark:bg-[#112236] border-emerald-500/60 shadow-lg shadow-emerald-500/5'
                    : 'bg-slate-50/70 dark:bg-[#0e1829] border-slate-200/80 dark:border-[#1c2d47]'
                } ${
                  dragOverTarget === `col-${wd.iso}`
                    ? 'ring-2 ring-amber-400 border-amber-400'
                    : ''
                }`}
              >
                {/* Column Header */}
                <div
                  className={`p-3 border-b text-center rounded-t-2xl ${
                    wd.isToday
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-slate-200/70 dark:border-[#1c2d47] bg-white/60 dark:bg-[#131f33]/70'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`text-xs font-extrabold ${
                        wd.isToday
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {wd.weekdayKey}, {wd.dayNumber}
                    </span>
                    {wd.isToday && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-extrabold uppercase">
                        Hoje
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {formatHoursMins(dayDoneMin)}/{formatHoursMins(dayPlannedMin)}
                  </div>
                </div>

                {/* Cards Stack */}
                <div className="p-2.5 space-y-2.5 flex-1">
                  {cards.map((card) => {
                    const isDropHovered = dragOverTarget === card.uid;
                    return (
                      <div
                        key={card.uid}
                        draggable={isReplanningMode && !card.isHistoryRecord}
                        onDragStart={() => {
                          if (!isReplanningMode || card.isHistoryRecord) return;
                          setDraggedCard({
                            cycleIndex: card.cycleIndex,
                            dayKey: wd.weekdayKey,
                            subject: card.subject,
                          });
                        }}
                        onDragOver={(e) => {
                          if (!isReplanningMode || card.isHistoryRecord) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverTarget(card.uid);
                        }}
                        onDrop={(e) => {
                          if (!isReplanningMode || card.isHistoryRecord) return;
                          e.preventDefault();
                          e.stopPropagation();
                          handleDropOnCardOrDay(card.cycleIndex, wd.weekdayKey);
                        }}
                        style={{
                          backgroundColor: card.isCompleted
                            ? `${card.color}18`
                            : `${card.color}28`,
                          borderColor: isDropHovered ? '#fbbf24' : `${card.color}66`,
                        }}
                        className={`group relative rounded-xl p-3 border transition-all shadow-sm ${
                          isReplanningMode && !card.isHistoryRecord
                            ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02] ring-1 ring-amber-400/40'
                            : 'hover:shadow-md'
                        } ${card.isCompleted ? 'opacity-70' : ''} ${
                          isDropHovered ? 'ring-2 ring-amber-400 -translate-y-0.5' : ''
                        }`}
                      >
                        {/* Top Row: Subject Title + Replan Grip or Play Button */}
                        <div className="flex items-start justify-between gap-1.5">
                          <h3
                            className="text-xs font-extrabold leading-snug text-slate-900 dark:text-white break-words"
                            style={{ color: undefined }}
                          >
                            {card.subject}
                          </h3>

                          {isReplanningMode && !card.isHistoryRecord ? (
                            <span
                              className="p-1 rounded bg-slate-900/20 text-slate-800 dark:text-white shrink-0"
                              title="Arraste para mudar de posição ou de dia"
                            >
                              <GripVertical size={13} />
                            </span>
                          ) : card.isCompleted ? (
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500 shrink-0 mt-0.5"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartBlockStudy(card)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-slate-900/75 text-white hover:bg-emerald-500 hover:text-slate-950 transition-all shrink-0"
                              title="Iniciar estudo deste bloco no cronômetro sincronizado"
                            >
                              <Play size={11} />
                            </button>
                          )}
                        </div>

                        {/* Duration / Questions Target */}
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 mt-1.5 opacity-90">
                          <Clock size={11} className="shrink-0" />
                          <span>{formatHoursMins(card.durationMinutes)}</span>
                          {card.questionsTarget && card.questionsTarget > 0 ? (
                            <span>• 🎯 {card.questionsTarget}q</span>
                          ) : null}
                        </div>

                        {/* Suggested Topic (Clickable to override in TopicQueueSelectorModal) */}
                        <button
                          type="button"
                          onClick={() => setTopicModalSubject(card.subject)}
                          className="mt-2 w-full text-left flex items-start gap-1 text-[11px] leading-snug font-medium text-slate-800 dark:text-slate-100/90 hover:underline group/topic"
                          title="Sugerido na ordem do seu edital. Clique para escolher outro tópico manualmente."
                        >
                          <Sparkles
                            size={11}
                            className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-300"
                          />
                          <span className="line-clamp-2 flex-1">
                            {card.suggestedTopic}
                          </span>
                          <Pencil
                            size={10}
                            className="shrink-0 mt-0.5 opacity-0 group-hover/topic:opacity-100"
                          />
                        </button>
                      </div>
                    );
                  })}

                  {/* "+" Button at the bottom of the column (just like Estudei screenshot) */}
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-[#243857] text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 flex items-center justify-center transition-colors text-xs font-bold"
                    title="Registrar estudo neste dia"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para escolher outro tópico manualmente para a disciplina clicada */}
      {topicModalSubject && (
        <TopicQueueSelectorModal
          isOpen={Boolean(topicModalSubject)}
          onClose={() => setTopicModalSubject(null)}
          subjectName={topicModalSubject}
          topics={
            stats?.editalData?.find(
              (s) => s.subject.toLowerCase() === topicModalSubject.toLowerCase()
            )?.topics || []
          }
          completedTopicNames={
            new Set(
              (studyRecords || [])
                .filter(
                  (r) =>
                    r.teoriaFinalizada &&
                    (r.subject || '').toLowerCase() === topicModalSubject.toLowerCase()
                )
                .map((r) => r.topic)
            )
          }
          currentSelectedTopic={getSubjectTopicOverride(topicModalSubject) || undefined}
          onSelectTopic={(selectedText) => {
            setSubjectTopicOverride(topicModalSubject, selectedText);
            setTopicOverrideTick((t) => t + 1);
            setTopicModalSubject(null);
          }}
        />
      )}
    </div>
  );
}
