'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData, StudyRecord, StudySession } from '../../context/DataContext';
import { getJsonContent } from '../actions';
import Link from 'next/link';
import { useNotification } from '../../context/NotificationContext';
import {
  Play,
  Plus,
  Sparkles,
  RotateCcw,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  History,
  Compass,
} from 'lucide-react';
import CycleCreationModal from '../../components/CycleCreationModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import StopwatchModal from '../../components/StopwatchModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Subject {
  id?: string;
  subject: string;
  topics: Topic[];
  color: string;
}

interface Topic {
  topic_text: string;
  sub_topics?: Topic[];
  is_completed?: boolean;
}

interface SubjectSettings {
  [key: string]: { importance: number; knowledge: number };
}

interface DonutChartProps {
  cycle: StudySession[];
  size?: number;
  remainingMinutes: number;
  hoveredSession: UniqueIdentifier | null;
  setHoveredSession: (id: UniqueIdentifier | null) => void;
  sessionProgressMap: { [key: string]: number };
}

const DonutChart = ({
  cycle,
  size = 240,
  remainingMinutes,
  hoveredSession,
  setHoveredSession,
  sessionProgressMap,
}: DonutChartProps) => {
  const strokeWidth = 28;
  const gap = 4;
  const mainRingRadius = size / 2 - strokeWidth - gap;
  const progressRingRadius = size / 2 - strokeWidth / 2;

  const mainCircumference = 2 * Math.PI * mainRingRadius;
  const progressCircumference = 2 * Math.PI * progressRingRadius;

  const formatMinutesToHoursMinutes = (minutes: number) => {
    if (minutes <= 0) return '0h00min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h${String(m).padStart(2, '0')}min`;
  };

  const segments = useMemo(() => {
    if (!cycle || cycle.length === 0) return [];
    const totalSessions = cycle.length;
    const mainSegmentLength = mainCircumference / totalSessions;
    const progressSegmentLength = progressCircumference / totalSessions;
    let offset = 0;

    return cycle.map((session) => {
      const progress = sessionProgressMap[session.id as string] || 0;
      const isCompleted = progress >= session.duration;
      const mainOffset = -offset * (mainCircumference / progressCircumference);
      const progressOffset = -offset;
      offset += progressSegmentLength;

      return {
        ...session,
        isCompleted,
        main: {
          key: `main-${session.id}`,
          strokeDasharray: `${Math.max(1, mainSegmentLength - 2)} ${mainCircumference}`,
          strokeDashoffset: mainOffset,
          color: isCompleted ? 'transparent' : session.color || '#10b981',
        },
        progress: {
          key: `progress-${session.id}`,
          strokeDasharray: `${Math.max(1, progressSegmentLength - 2)} ${progressCircumference}`,
          strokeDashoffset: progressOffset,
          color: isCompleted ? '#10b981' : 'transparent',
        },
      };
    });
  }, [cycle, mainCircumference, progressCircumference, sessionProgressMap]);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={progressRingRadius}
          fill="transparent"
          strokeWidth={strokeWidth / 2}
          className="stroke-slate-100 dark:stroke-[#0b1320]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={mainRingRadius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className="stroke-slate-100 dark:stroke-[#0b1320]"
        />

        {segments.map((segment) => (
          <circle
            key={segment.progress.key}
            cx={size / 2}
            cy={size / 2}
            r={progressRingRadius}
            fill="transparent"
            stroke={segment.progress.color}
            strokeWidth={strokeWidth / 2}
            strokeDasharray={segment.progress.strokeDasharray}
            strokeDashoffset={segment.progress.strokeDashoffset}
          />
        ))}

        {segments.map((segment) => (
          <circle
            key={segment.main.key}
            cx={size / 2}
            cy={size / 2}
            r={mainRingRadius}
            fill="transparent"
            stroke={segment.main.color}
            strokeWidth={
              hoveredSession === segment.id && !segment.isCompleted
                ? strokeWidth + 6
                : strokeWidth
            }
            strokeDasharray={segment.main.strokeDasharray}
            strokeDashoffset={segment.main.strokeDashoffset}
            onMouseEnter={() => !segment.isCompleted && setHoveredSession(segment.id)}
            onMouseLeave={() => setHoveredSession(null)}
            style={{ transition: 'stroke-width 0.2s ease' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Restante
        </span>
        <span className="text-lg font-extrabold text-slate-900 dark:text-white">
          {formatMinutesToHoursMinutes(remainingMinutes)}
        </span>
      </div>
    </div>
  );
};

interface SortableItemProps {
  session: StudySession;
  suggestedTopic: string;
  hoveredSession: UniqueIdentifier | null;
  setHoveredSession: (id: UniqueIdentifier | null) => void;
  sessionProgressMap: { [key: string]: number };
  formatMinutesToHoursMinutes: (minutes: number) => string;
  onStartTimer: (session: StudySession, topic: string) => void;
  onManualRegister: (session: StudySession, topic: string) => void;
  isEditMode: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (session: StudySession) => void;
  onDurationChange: (id: string, newDuration: number) => void;
}

const SortableItem = ({
  session,
  suggestedTopic,
  setHoveredSession,
  sessionProgressMap,
  formatMinutesToHoursMinutes,
  onStartTimer,
  onManualRegister,
  isEditMode,
  onDelete,
  onDuplicate,
  onDurationChange,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: session.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentProgress = sessionProgressMap[session.id as string] || 0;
  const progressPercentage =
    session.duration > 0 ? Math.min(100, (currentProgress / session.duration) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHoveredSession(session.id)}
      onMouseLeave={() => setHoveredSession(null)}
      className="group bg-slate-50/70 dark:bg-[#0b1320]/70 hover:bg-slate-100/80 dark:hover:bg-[#17263f]/70 border border-slate-200/80 dark:border-[#1f304a] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
          title="Arrastar para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span
          className="w-2.5 h-9 rounded-full shrink-0"
          style={{ backgroundColor: session.color || '#10b981' }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {session.subject}
            </h4>
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {formatMinutesToHoursMinutes(currentProgress)} /{' '}
              {formatMinutesToHoursMinutes(session.duration)}
            </span>
          </div>

          {suggestedTopic && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400/90 truncate mt-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 shrink-0" />
              Sugestão: {suggestedTopic}
            </p>
          )}

          {progressPercentage > 0 && (
            <div className="w-full max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-[#1a2942] mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {isEditMode ? (
          <>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={session.duration}
                min={15}
                step={15}
                onChange={(e) =>
                  onDurationChange(session.id as string, Math.max(15, Number(e.target.value)))
                }
                className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-xs font-bold text-center text-slate-900 dark:text-white"
              />
              <span className="text-[11px] text-slate-400">min</span>
            </div>
            <button
              type="button"
              onClick={() => onDuplicate(session)}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
              title="Duplicar bloco"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(session.id as string)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
              title="Excluir bloco"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onStartTimer(session, suggestedTopic)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Iniciar
            </button>
            <button
              type="button"
              onClick={() => onManualRegister(session, suggestedTopic)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200/70 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors"
              title="Registrar Estudo Manual"
            >
              <Plus className="w-3.5 h-3.5" />
              Manual
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default function Planejamento() {
  const {
    selectedDataFile,
    addStudyRecord,
    updateStudyRecord,
    resetStudyCycle,
    studyCycle,
    setStudyCycle,
    completedCycles,
    currentProgressMinutes,
    sessionProgressMap,
    setCurrentStudySession,
    initialStudyRecord,
    setInitialStudyRecord,
    stopwatchTargetDuration,
    setStopwatchTargetDuration,
    stopwatchModalSubject,
    setStopwatchModalSubject,
    studyHours,
    weeklyQuestionsGoal,
    studyDays,
    getRecommendedSession,
    studyRecords,
    deleteStudyRecord,
    cycleGenerationTimestamp,
  } = useData();
  const { showNotification } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isStopwatchModalOpen, setIsStopwatchModalOpen] = useState(false);
  const [stopwatchInitialTopic, setStopwatchInitialTopic] = useState<string>('');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectSettings, setSubjectSettings] = useState<SubjectSettings>({});

  const [recommendationJustification, setRecommendationJustification] = useState<
    string | null
  >(null);
  const [hoveredSession, setHoveredSession] = useState<UniqueIdentifier | null>(null);
  const [showCompletedSection, setShowCompletedSection] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [durationToAdd, setDurationToAdd] = useState<number>(60);
  const [sessionToReset, setSessionToReset] = useState<StudySession | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    async function loadSubjects() {
      if (selectedDataFile) {
        const data: Subject[] | { subjects: Subject[] } =
          await getJsonContent(selectedDataFile);
        let subjectsArray: Subject[] = [];
        if (Array.isArray(data)) {
          subjectsArray = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.subjects)) {
          subjectsArray = data.subjects;
        }
        const subjectsWithColors = subjectsArray.map((s: Subject) => ({
          ...s,
          color: s.color || '#10b981',
        }));
        setSubjects(subjectsWithColors);
      } else {
        setSubjects([]);
      }
    }
    loadSubjects();
  }, [selectedDataFile]);

  const totalCycleDuration = useMemo(() => {
    if (!studyCycle) return 0;
    return studyCycle.reduce((sum, session) => sum + session.duration, 0);
  }, [studyCycle]);

  const totalProgressMinutes = useMemo(() => {
    if (!sessionProgressMap || Object.keys(sessionProgressMap).length === 0) return 0;
    return Object.values(sessionProgressMap).reduce((sum, progress) => sum + progress, 0);
  }, [sessionProgressMap]);

  const remainingMinutes = Math.max(0, totalCycleDuration - totalProgressMinutes);
  const cycleCompletionPct =
    totalCycleDuration > 0
      ? Math.min(100, Math.round((totalProgressMinutes / totalCycleDuration) * 100))
      : 0;

  const formatMinutesToHoursMinutes = (minutes: number) => {
    if (minutes <= 0) return '0min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min`;
  };

  // Next unstudied topic sequence finder per subject
  const getSuggestedTopicForSubject = useCallback(
    (subjectName: string): string => {
      const rec = getRecommendedSession({ forceSubject: subjectName });
      if (rec?.recommendedTopic?.topic) {
        return rec.recommendedTopic.topic;
      }
      const subj = subjects.find((s) => s.subject === subjectName);
      if (!subj || !subj.topics) return '';
      const studiedSet = new Set(
        studyRecords.filter((r) => r.subject === subjectName).map((r) => r.topic)
      );
      const findFirstUnstudied = (list: Topic[]): string => {
        for (const t of list) {
          if (t.sub_topics && t.sub_topics.length > 0) {
            const sub = findFirstUnstudied(t.sub_topics);
            if (sub) return sub;
          } else if (!t.is_completed && !studiedSet.has(t.topic_text)) {
            return t.topic_text;
          }
        }
        return '';
      };
      return findFirstUnstudied(subj.topics) || subj.topics[0]?.topic_text || '';
    },
    [getRecommendedSession, subjects, studyRecords]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && studyCycle) {
      const oldIndex = studyCycle.findIndex((item) => item.id === active.id);
      const newIndex = studyCycle.findIndex((item) => item.id === over!.id);
      if (oldIndex > -1 && newIndex > -1) {
        setStudyCycle(arrayMove(studyCycle, oldIndex, newIndex));
      }
    }
  };

  const handleDeleteSession = (id: string) => {
    if (!studyCycle) return;
    setStudyCycle((prevCycle) => (prevCycle ? prevCycle.filter((s) => s.id !== id) : null));
  };

  const handleDuplicateSession = (session: StudySession) => {
    if (!studyCycle) return;
    const newSession = { ...session, id: `${Date.now()}-session-copy` };
    const index = studyCycle.findIndex((s) => s.id === session.id);
    if (index > -1) {
      const newCycle = [...studyCycle];
      newCycle.splice(index + 1, 0, newSession);
      setStudyCycle(newCycle);
    }
  };

  const handleDurationChange = (id: string, newDuration: number) => {
    if (!studyCycle) return;
    setStudyCycle((prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, duration: newDuration } : s)) : null
    );
  };

  const handleAddSession = () => {
    if (!subjectToAdd || !durationToAdd || durationToAdd <= 0) {
      showNotification('Selecione uma disciplina e uma duração válida.', 'warning');
      return;
    }
    const subjectData = subjects.find((s) => s.subject === subjectToAdd);
    if (!subjectData) return;

    const newSession: StudySession = {
      id: `${Date.now()}-session-manual`,
      subject: subjectData.subject,
      subjectId: subjectData.id || subjectData.subject,
      duration: durationToAdd,
      color: subjectData.color || '#10b981',
    };

    setStudyCycle((prev) => (prev ? [...prev, newSession] : [newSession]));
    setSubjectToAdd('');
  };

  const handleStartTimerForSession = (session: StudySession, topic: string) => {
    setStopwatchTargetDuration(session.duration);
    setStopwatchModalSubject(session.subject);
    setStopwatchInitialTopic(topic);
    setCurrentStudySession(session);
    setIsStopwatchModalOpen(true);
  };

  const handleManualRegisterForSession = (session: StudySession, topic: string) => {
    const prefilledRecord: Partial<StudyRecord> = {
      subject: session.subject,
      topic: topic || '',
      category: 'teoria',
      countInPlanning: true,
      studyTime: session.duration * 60 * 1000,
    };
    setInitialStudyRecord(prefilledRecord);
    setCurrentStudySession(session);
    setIsRegisterModalOpen(true);
  };

  const handleSaveRecord = useCallback(
    async (record: StudyRecord) => {
      try {
        if (record.id) {
          await updateStudyRecord(record);
        } else {
          await addStudyRecord(record);
        }
        setIsRegisterModalOpen(false);
        setInitialStudyRecord(null);
        setCurrentStudySession(null);
        setRecommendationJustification(null);
      } catch (error) {
        showNotification('Erro ao salvar registro de estudo.', 'error');
      }
    },
    [updateStudyRecord, addStudyRecord, showNotification, setCurrentStudySession, setInitialStudyRecord]
  );

  const pendingSessions = useMemo(
    () =>
      (studyCycle || []).filter(
        (s) => (sessionProgressMap[s.id as string] || 0) < s.duration
      ),
    [studyCycle, sessionProgressMap]
  );

  const completedSessions = useMemo(
    () =>
      (studyCycle || []).filter(
        (s) => (sessionProgressMap[s.id as string] || 0) >= s.duration
      ),
    [studyCycle, sessionProgressMap]
  );

  const nextHighlightSession = pendingSessions[0] || null;
  const nextSuggestedTopic = nextHighlightSession
    ? getSuggestedTopicForSubject(nextHighlightSession.subject)
    : '';

  if (!isClient) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Planejamento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Siga a sequência inteligente do seu ciclo com sugestão automática do próximo tópico
          </p>
        </div>

        {studyCycle && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replanejar Ciclo
            </button>

            <button
              onClick={() => setIsEditMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isEditMode
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-indigo-500 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditMode ? 'Concluir Edição' : 'Editar Ciclo'}
            </button>

            <button
              onClick={resetStudyCycle}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover
            </button>
          </div>
        )}
      </div>

      {studyCycle ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Next Study Highlight + Sequence */}
          <div className="lg:col-span-8 space-y-6">
            {/* Highlighted NEXT STUDY Card (Estudei Print 6) */}
            {nextHighlightSession && (
              <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shrink-0 shadow-md"
                      style={{ backgroundColor: nextHighlightSession.color || '#10b981' }}
                    >
                      <Compass className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white mb-1">
                        PRÓXIMO ESTUDO DA FILA
                      </span>
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                        {nextHighlightSession.subject}
                      </h2>
                      {nextSuggestedTopic && (
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300 mt-0.5 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>Sugestão do Edital: {nextSuggestedTopic}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Bloco de {formatMinutesToHoursMinutes(nextHighlightSession.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() =>
                        handleStartTimerForSession(nextHighlightSession, nextSuggestedTopic)
                      }
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Iniciar Estudo
                    </button>
                    <button
                      onClick={() =>
                        handleManualRegisterForSession(nextHighlightSession, nextSuggestedTopic)
                      }
                      className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-[#131f33] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#243552] hover:border-emerald-500 transition-colors"
                    >
                      Registrar Manual
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Study Sequence Card */}
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Sequência dos Estudos ({pendingSessions.length} blocos restantes)
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isEditMode
                      ? 'Modo Edição ativo: arraste os blocos, altere os minutos, duplique ou adicione novas disciplinas'
                      : 'Arraste os blocos para reorganizar sua fila a qualquer momento'}
                  </p>
                </div>
              </div>

              {/* Add session bar in Edit Mode */}
              {isEditMode && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-emerald-500/30 flex flex-col sm:flex-row items-center gap-3">
                  <select
                    value={subjectToAdd}
                    onChange={(e) => setSubjectToAdd(e.target.value)}
                    className="flex-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="">Adicionar disciplina ao ciclo...</option>
                    {subjects.map((s) => (
                      <option key={s.subject} value={s.subject}>
                        {s.subject}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="number"
                      value={durationToAdd}
                      onChange={(e) => setDurationToAdd(Number(e.target.value))}
                      min={15}
                      step={15}
                      className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-400">min</span>
                    <button
                      type="button"
                      onClick={handleAddSession}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shrink-0"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Pending Sortable List */}
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={studyCycle}
                    strategy={verticalListSortingStrategy}
                  >
                    {pendingSessions.length > 0 ? (
                      pendingSessions.map((session) => (
                        <SortableItem
                          key={session.id}
                          session={session}
                          suggestedTopic={getSuggestedTopicForSubject(session.subject)}
                          hoveredSession={hoveredSession}
                          setHoveredSession={setHoveredSession}
                          sessionProgressMap={sessionProgressMap}
                          formatMinutesToHoursMinutes={formatMinutesToHoursMinutes}
                          onStartTimer={handleStartTimerForSession}
                          onManualRegister={handleManualRegisterForSession}
                          isEditMode={isEditMode}
                          onDelete={handleDeleteSession}
                          onDuplicate={handleDuplicateSession}
                          onDurationChange={handleDurationChange}
                        />
                      ))
                    ) : (
                      <div className="p-8 text-center text-sm text-emerald-500 font-semibold bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                        Parabéns! Você concluiu todos os blocos deste ciclo!
                      </div>
                    )}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Completed Blocks Collapsible Section (Estudei Print 6) */}
              {completedSessions.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-[#1f304a]">
                  <button
                    type="button"
                    onClick={() => setShowCompletedSection((prev) => !prev)}
                    className="w-full flex items-center justify-between py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Estudos Concluídos no Ciclo ({completedSessions.length})
                    </span>
                    {showCompletedSection ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showCompletedSection && (
                    <div className="space-y-2 mt-3">
                      {completedSessions.map((session) => {
                        const lastRec = studyRecords
                          .filter((r) => r.subject === session.subject)
                          .slice(-1)[0];
                        return (
                          <div
                            key={session.id}
                            className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {session.subject}
                                </div>
                                {lastRec?.topic && (
                                  <div className="text-[11px] text-slate-400 truncate">
                                    Estudado: {lastRec.topic}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-500 shrink-0">
                              {formatMinutesToHoursMinutes(session.duration)} /{' '}
                              {formatMinutesToHoursMinutes(session.duration)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Progress & Donut Chart */}
          <div className="lg:col-span-4 space-y-6">
            {/* Cycle Progress KPI Card */}
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Progresso do Ciclo
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {cycleCompletionPct}%
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Ciclos Completos
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-500">
                    {completedCycles}
                  </span>
                </div>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${cycleCompletionPct}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>Estudado: {formatMinutesToHoursMinutes(totalProgressMinutes)}</span>
                <span>Total: {formatMinutesToHoursMinutes(totalCycleDuration)}</span>
              </div>
            </div>

            {/* Donut Chart Card */}
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white self-start mb-4">
                Distribuição do Ciclo
              </h3>
              <DonutChart
                cycle={studyCycle}
                size={230}
                remainingMinutes={remainingMinutes}
                hoveredSession={hoveredSession}
                setHoveredSession={setHoveredSession}
                sessionProgressMap={sessionProgressMap}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-12 text-center max-w-2xl mx-auto my-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            Monte seu Ciclo de Estudos Inteligente
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Defina suas disciplinas, horas semanais, nível de domínio e peso na prova. O Ouroboros organiza seus blocos e sugere automaticamente qual tópico do edital estudar em seguida.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Criar Planejamento Agora
          </button>

          {subjects.length === 0 && (
            <p className="mt-6 text-xs text-amber-400">
              Dica: Você ainda não tem disciplinas no plano ativo.{' '}
              <Link href="/planos" className="underline font-bold text-emerald-400">
                Importe um edital via IA ou crie um plano
              </Link>{' '}
              primeiro.
            </p>
          )}
        </div>
      )}

      <StudyRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setInitialStudyRecord(null);
          setCurrentStudySession(null);
          setRecommendationJustification(null);
        }}
        onSave={handleSaveRecord}
        initialRecord={initialStudyRecord}
        justification={recommendationJustification}
        showDeleteButton={!!initialStudyRecord?.id}
      />

      <StopwatchModal
        isOpen={isStopwatchModalOpen}
        onClose={() => setIsStopwatchModalOpen(false)}
        onSaveAndClose={async (time, subject, topic) => {
          const newRecord: Partial<StudyRecord> = {
            date: new Date().toISOString().split('T')[0],
            subject: subject || '',
            topic: topic || stopwatchInitialTopic || '',
            studyTime: time,
            questions: { correct: 0, total: 0 },
            material: '',
            category: 'teoria',
            notes: '',
            reviewPeriods: [],
            teoriaFinalizada: false,
            countInPlanning: true,
            pages: [],
            videos: [],
          };
          setInitialStudyRecord(newRecord);
          setIsStopwatchModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
        targetDuration={stopwatchTargetDuration}
        subject={stopwatchModalSubject}
        initialTopic={stopwatchInitialTopic}
      />

      <CycleCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isEditing={!!studyCycle}
        initialData={
          studyCycle
            ? {
                studyHours,
                weeklyQuestionsGoal,
                subjectSettings,
                selectedSubjects,
                minSession: '45',
                maxSession: '90',
                studyDays,
              }
            : undefined
        }
      />
    </div>
  );
}
