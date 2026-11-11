'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Compass,
  MoreVertical,
  BookOpen,
  BarChart2,
  RefreshCw,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import CycleCreationModal from '../../components/CycleCreationModal';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import TopicQueueSelectorModal, {
  getSubjectTopicOverride,
} from '../../components/TopicQueueSelectorModal';
import { findTopicNotebookUrl } from '../../lib/scoreEngine';
import { startGlobalTimerSession } from '../../lib/timerStore';
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

// Utilitário geométrico para desenhar arcos anulares (fatias do Donut estilo Estudei)
function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function createAnnularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    startOuter.x,
    startOuter.y,
    'A',
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    endOuter.x,
    endOuter.y,
    'L',
    endInner.x,
    endInner.y,
    'A',
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    startInner.x,
    startInner.y,
    'Z',
  ].join(' ');
}

interface MultiRingDonutChartProps {
  cycle: StudySession[];
  size?: number;
  completionPct: number;
  studiedMinutes: number;
  totalMinutes: number;
  hoveredSession: UniqueIdentifier | null;
  setHoveredSession: (id: UniqueIdentifier | null) => void;
  sessionProgressMap: { [key: string]: number };
  formatMinutesToHoursMinutes: (minutes: number) => string;
}

const MultiRingDonutChart = ({
  cycle,
  size = 260,
  completionPct,
  studiedMinutes,
  totalMinutes,
  hoveredSession,
  setHoveredSession,
  sessionProgressMap,
  formatMinutesToHoursMinutes,
}: MultiRingDonutChartProps) => {
  const cx = size / 2;
  const cy = size / 2;

  // Anel externo (status de conclusão do bloco) e anel interno (cor da disciplina do bloco)
  const outerRingOuterR = size / 2 - 6;
  const outerRingInnerR = size / 2 - 24;
  const innerRingOuterR = size / 2 - 28;
  const innerRingInnerR = size / 2 - 68;

  const segments = useMemo(() => {
    if (!cycle || cycle.length === 0) return [];
    const n = cycle.length;
    const stepAngle = 360 / n;
    const gapDegrees = n > 1 ? Math.min(3.2, 45 / n) : 0;

    return cycle.map((session, idx) => {
      const startAngle = idx * stepAngle + gapDegrees / 2;
      const endAngle = (idx + 1) * stepAngle - gapDegrees / 2;
      const progress = sessionProgressMap[session.id as string] || 0;
      const isCompleted = progress >= session.duration;
      const isPartial = progress > 0 && progress < session.duration;

      return {
        ...session,
        isCompleted,
        isPartial,
        outerPath: createAnnularSectorPath(
          cx,
          cy,
          outerRingInnerR,
          outerRingOuterR,
          startAngle,
          endAngle
        ),
        innerPath: createAnnularSectorPath(
          cx,
          cy,
          innerRingInnerR,
          innerRingOuterR,
          startAngle,
          endAngle
        ),
      };
    });
  }, [
    cycle,
    cx,
    cy,
    outerRingInnerR,
    outerRingOuterR,
    innerRingInnerR,
    innerRingOuterR,
    sessionProgressMap,
  ]);

  return (
    <div className="relative flex items-center justify-center my-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Anel Externo: colorido quando concluído/parcial, cinza/slate escuro quando pendente */}
        {segments.map((seg) => {
          const isHovered = hoveredSession === seg.id;
          return (
            <path
              key={`outer-${seg.id}`}
              d={seg.outerPath}
              fill={
                seg.isCompleted || seg.isPartial
                  ? seg.color || '#10b981'
                  : 'currentColor'
              }
              fillOpacity={seg.isCompleted ? 1 : seg.isPartial ? 0.55 : 1}
              className={
                seg.isCompleted || seg.isPartial
                  ? 'transition-all duration-200'
                  : 'text-slate-200 dark:text-[#243247] transition-all duration-200'
              }
              strokeLinejoin="round"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              }}
              onMouseEnter={() => setHoveredSession(seg.id)}
              onMouseLeave={() => setHoveredSession(null)}
            />
          );
        })}

        {/* Anel Interno: sempre colorido com a cor de cada bloco do ciclo */}
        {segments.map((seg) => {
          const isHovered = hoveredSession === seg.id;
          return (
            <path
              key={`inner-${seg.id}`}
              d={seg.innerPath}
              fill={seg.color || '#10b981'}
              fillOpacity={seg.isCompleted ? 0.95 : 0.85}
              strokeLinejoin="round"
              className="transition-all duration-200 cursor-pointer"
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: isHovered ? 'scale(1.03)' : 'scale(1)',
              }}
              onMouseEnter={() => setHoveredSession(seg.id)}
              onMouseLeave={() => setHoveredSession(null)}
            />
          );
        })}
      </svg>

      {/* Centro do Donut: % e Tempo Estudado / Previsto */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
        <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {completionPct}%
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
          {formatMinutesToHoursMinutes(studiedMinutes)} /{' '}
          {formatMinutesToHoursMinutes(totalMinutes)}
        </span>
      </div>
    </div>
  );
};

interface SortableItemProps {
  session: StudySession;
  suggestedTopic: string;
  notebookUrl?: string | null;
  showSuggestedTopic: boolean;
  hoveredSession: UniqueIdentifier | null;
  setHoveredSession: (id: UniqueIdentifier | null) => void;
  sessionProgressMap: { [key: string]: number };
  formatMinutesToHoursMinutes: (minutes: number) => string;
  onStartTimer: (session: StudySession, topic: string) => void;
  onManualRegister: (session: StudySession, topic: string) => void;
  onOpenTopicSelector: (subjectName: string, subjectColor?: string) => void;
  isEditMode: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (session: StudySession) => void;
  onDurationChange: (id: string, newDuration: number) => void;
}

const SortableItem = ({
  session,
  suggestedTopic,
  notebookUrl,
  showSuggestedTopic,
  hoveredSession,
  setHoveredSession,
  sessionProgressMap,
  formatMinutesToHoursMinutes,
  onStartTimer,
  onManualRegister,
  onOpenTopicSelector,
  isEditMode,
  onDelete,
  onDuplicate,
  onDurationChange,
}: SortableItemProps) => {
  // Desativa o drag-and-drop quando não está em Modo de Edição
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: session.id,
    disabled: !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const currentProgress = Math.round(sessionProgressMap[session.id as string] || 0);
  const remainingMinutes = Math.max(1, Math.round(session.duration - currentProgress));
  const progressPercentage =
    session.duration > 0 ? Math.min(100, (currentProgress / session.duration) * 100) : 0;
  const isHovered = hoveredSession === session.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHoveredSession(session.id)}
      onMouseLeave={() => setHoveredSession(null)}
      className={`group rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all border ${
        isHovered
          ? 'bg-slate-100/90 dark:bg-[#182742] border-emerald-500/40'
          : 'bg-slate-50/60 dark:bg-[#0f192a]/70 hover:bg-slate-100/70 dark:hover:bg-[#16243d]/70 border-slate-200/70 dark:border-[#1f304a]'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {isEditMode && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0"
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        <Link
          href={`/materias/${encodeURIComponent(session.subject)}`}
          title={`Ir para ${session.subject}`}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0 shadow-sm hover:scale-105 transition-transform"
          style={{ backgroundColor: session.color || '#10b981' }}
        >
          <BookOpen className="w-4 h-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/materias/${encodeURIComponent(session.subject)}`}
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-500 transition-colors truncate"
              title={`Abrir disciplina ${session.subject}`}
            >
              {session.subject}
            </Link>
            {currentProgress > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                Faltam {formatMinutesToHoursMinutes(remainingMinutes)} (
                {formatMinutesToHoursMinutes(currentProgress)} /{' '}
                {formatMinutesToHoursMinutes(session.duration)})
              </span>
            )}
          </div>

          {showSuggestedTopic && suggestedTopic && (
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <button
                type="button"
                onClick={() => onOpenTopicSelector(session.subject, session.color)}
                title="Sugerido a partir do seu edital, na ordem dele. Toque para escolher outro."
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-500 border-b border-dashed border-slate-400/40 hover:border-emerald-500 truncate inline-flex items-center gap-1 max-w-full text-left transition-colors"
              >
                <span className="truncate">{suggestedTopic}</span>
                <Pencil className="w-3 h-3 shrink-0 opacity-65" />
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
                  className="p-0.5 rounded text-indigo-500 hover:text-indigo-400 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
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
      <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
        {isEditMode ? (
          <>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={session.duration}
                min={15}
                step={5}
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
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Clock className="w-3.5 h-3.5" />
              {currentProgress > 0
                ? formatMinutesToHoursMinutes(remainingMinutes)
                : formatMinutesToHoursMinutes(session.duration)}
            </span>
            <button
              type="button"
              onClick={() => onStartTimer(session, suggestedTopic)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white border border-indigo-500/25 transition-all"
              title="Abrir Cronômetro em Modo Foco"
            >
              <Play className="w-3 h-3 fill-current" />
              Iniciar
            </button>
            <button
              type="button"
              onClick={() => onManualRegister(session, suggestedTopic)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-200/70 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
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
    restartStudyCycle,
    studyCycle,
    setStudyCycle,
    completedCycles,
    sessionProgressMap,
    setCurrentStudySession,
    initialStudyRecord,
    setInitialStudyRecord,
    setIsStopwatchModalOpen,
    setStopwatchTargetDuration,
    setStopwatchModalSubject,
    studyHours,
    weeklyQuestionsGoal,
    studyDays,
    getRecommendedSession,
    studyRecords,
  } = useData();
  const { showNotification } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects] = useState<string[]>([]);
  const [subjectSettings] = useState<SubjectSettings>({});

  const [recommendationJustification, setRecommendationJustification] = useState<
    string | null
  >(null);
  const [hoveredSession, setHoveredSession] = useState<UniqueIdentifier | null>(null);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
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
  const [isClient, setIsClient] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [subjectToAdd, setSubjectToAdd] = useState<string>('');
  const [durationToAdd, setDurationToAdd] = useState<number>(60);

  // Menu de 3 pontos (...), toggle de sugerir tópicos, modais de confirmação e expansão da lista de disciplinas
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [autoSuggestTopics, setAutoSuggestTopics] = useState(true);
  const [showAllSubjectsInChart, setShowAllSubjectsInChart] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    const savedSuggest = localStorage.getItem('alexandria_auto_suggest_topics');
    if (savedSuggest !== null) {
      setAutoSuggestTopics(savedSuggest === 'true');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target as Node)
      ) {
        setIsOptionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    if (!studyCycle || !sessionProgressMap) return 0;
    return studyCycle.reduce(
      (sum, s) => sum + Math.min(s.duration, sessionProgressMap[s.id as string] || 0),
      0
    );
  }, [studyCycle, sessionProgressMap]);

  const cycleCompletionPct =
    totalCycleDuration > 0
      ? Math.min(100, Math.round((totalProgressMinutes / totalCycleDuration) * 100))
      : 0;

  const formatMinutesToHoursMinutes = useCallback((minutes: number) => {
    if (minutes <= 0) return '0min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m}min`;
  }, []);

  // Agregação das disciplinas para a lista abaixo do Donut Chart (Estilo Estudei Print 8 & 9)
  const subjectBreakdownList = useMemo(() => {
    if (!studyCycle || studyCycle.length === 0) return [];
    const map = new Map<
      string,
      {
        subject: string;
        color: string;
        count: number;
        plannedMinutes: number;
        studiedMinutes: number;
      }
    >();

    for (const session of studyCycle) {
      const key = session.subject;
      const studied = Math.min(
        session.duration,
        Math.round(sessionProgressMap[session.id as string] || 0)
      );
      if (!map.has(key)) {
        map.set(key, {
          subject: session.subject,
          color: session.color || '#10b981',
          count: 1,
          plannedMinutes: session.duration,
          studiedMinutes: studied,
        });
      } else {
        const entry = map.get(key)!;
        entry.count += 1;
        entry.plannedMinutes += session.duration;
        entry.studiedMinutes += studied;
      }
    }
    return Array.from(map.values());
  }, [studyCycle, sessionProgressMap]);

  const visibleSubjectsInChart = showAllSubjectsInChart
    ? subjectBreakdownList
    : subjectBreakdownList.slice(0, 7);

  // Busca o próximo tópico pendente no edital da disciplina (ou o escolhido pelo usuário)
  const getSuggestedTopicForSubject = useCallback(
    (subjectName: string): string => {
      void overrideVersion;
      const manualChoice = getSubjectTopicOverride(subjectName);
      if (manualChoice) return manualChoice;

      const subj = subjects.find(
        (s) => s.subject?.toLowerCase() === subjectName?.toLowerCase()
      );
      if (subj && subj.topics && subj.topics.length > 0) {
        const completedSet = new Set(
          studyRecords
            .filter((r) => r.subject === subjectName && r.teoriaFinalizada)
            .map((r) => r.topic)
        );
        const findFirstUncompleted = (list: Topic[]): string => {
          for (const t of list) {
            if (t.sub_topics && t.sub_topics.length > 0) {
              const sub = findFirstUncompleted(t.sub_topics);
              if (sub) return sub;
            } else if (!t.is_completed && !completedSet.has(t.topic_text)) {
              return t.topic_text;
            }
          }
          return '';
        };
        const nextInSequence = findFirstUncompleted(subj.topics);
        if (nextInSequence) return nextInSequence;
      }

      const rec = getRecommendedSession({ forceSubject: subjectName });
      if (rec?.recommendedTopic?.topic) {
        return rec.recommendedTopic.topic;
      }
      return subj?.topics?.[0]?.topic_text || '';
    },
    [getRecommendedSession, subjects, studyRecords, overrideVersion]
  );

  const openTopicSelectorForSubject = useCallback(
    (subjectName: string, subjectColor?: string) => {
      const subj = subjects.find(
        (s) => s.subject?.toLowerCase() === subjectName?.toLowerCase()
      );
      setTopicModalTarget({
        subjectName,
        subjectColor: subjectColor || subj?.color || '#10b981',
        topics: subj?.topics || [],
        currentTopic: getSuggestedTopicForSubject(subjectName),
      });
    },
    [subjects, getSuggestedTopicForSubject]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditMode) return;
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
    setStudyCycle((prevCycle) =>
      prevCycle ? prevCycle.filter((s) => s.id !== id) : null
    );
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
    const prog = Math.round(sessionProgressMap[session.id as string] || 0);
    const remainingMin = Math.max(1, Math.round(session.duration - prog));
    setStopwatchTargetDuration(remainingMin);
    setStopwatchModalSubject(session.subject);
    setCurrentStudySession(session);
    startGlobalTimerSession({
      subject: session.subject,
      topic: autoSuggestTopics ? topic : '',
      subjectColor: session.color || '#10b981',
      targetDurationMinutes: remainingMin,
      autoStart: true,
    });
    setIsStopwatchModalOpen(true);
  };

  const handleManualRegisterForSession = (session: StudySession, topic: string) => {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')}`;
    const prefilledRecord: Partial<StudyRecord> = {
      subjectId: session.subjectId,
      subject: session.subject,
      topic: autoSuggestTopics ? topic || '' : '',
      category: 'teoria',
      countInPlanning: true,
      date: todayLocal,
      studyTime: 0, // Vazio com placeholder 00:00:00
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
        setRecommendationJustification(null);
      } catch (error) {
        showNotification('Erro ao salvar registro de estudo.', 'error');
      }
    },
    [updateStudyRecord, addStudyRecord, showNotification, setInitialStudyRecord]
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
  const upcomingQueueSessions = isEditMode ? pendingSessions : pendingSessions.slice(1);
  const nextSuggestedTopic = nextHighlightSession
    ? getSuggestedTopicForSubject(nextHighlightSession.subject)
    : '';

  const nextHighlightProgress = nextHighlightSession
    ? Math.round(sessionProgressMap[nextHighlightSession.id as string] || 0)
    : 0;
  const nextHighlightRemaining = nextHighlightSession
    ? Math.max(1, Math.round(nextHighlightSession.duration - nextHighlightProgress))
    : 0;
  const nextHighlightPct =
    nextHighlightSession && nextHighlightSession.duration > 0
      ? Math.min(100, Math.round((nextHighlightProgress / nextHighlightSession.duration) * 100))
      : 0;

  if (!isClient) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Planejamento
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize sua rotina de estudos e acompanhe o avanço de cada bloco do ciclo
          </p>
        </div>
      </div>

      {studyCycle ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda (7 cols): Cards de Topo + Sequência dos Estudos */}
          <div className="lg:col-span-7 space-y-6">
            {/* Linha Superior: 2 Cards KPI (Ciclos Completos & Progresso do Ciclo - Estilo Estudei Print 6 & 8) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Ciclos Completos */}
              <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Ciclos Completos
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <RefreshCw size={15} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {completedCycles}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    desde o início do planejamento
                  </p>
                </div>
              </div>

              {/* Card 2: Progresso do Ciclo */}
              <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Progresso do Ciclo
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <BarChart2 size={16} />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {cycleCompletionPct}%
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden my-2">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${cycleCompletionPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {formatMinutesToHoursMinutes(totalProgressMinutes)} de{' '}
                    {formatMinutesToHoursMinutes(totalCycleDuration)}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Principal: Sequência dos Estudos */}
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 sm:p-6 shadow-sm space-y-5">
              {/* Cabeçalho com Botões Editar Ciclo, Replanejar e Menu (...) */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sequência dos Estudos
                  </h3>
                  {isEditMode && (
                    <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">
                      Modo de edição ativo: arraste para reordenar ou ajuste os tempos
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isEditMode
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'bg-slate-50 dark:bg-[#0f192a] border-slate-200 dark:border-[#243552] text-slate-700 dark:text-slate-200 hover:border-emerald-500/50'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isEditMode ? 'Concluir edição' : 'Editar ciclo'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#0f192a] border border-slate-200 dark:border-[#243552] text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    Replanejar
                  </button>

                  {/* Botão 3 Pontinhos (...) Estilo Estudei Print 6 */}
                  <div className="relative" ref={optionsMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsOptionsMenuOpen((prev) => !prev)}
                      className={`p-2 rounded-xl border transition-all ${
                        isOptionsMenuOpen
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                          : 'border-slate-200 dark:border-[#243552] bg-slate-50 dark:bg-[#0f192a] text-slate-500 dark:text-slate-300 hover:border-emerald-500/50'
                      }`}
                      title="Mais opções do ciclo"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isOptionsMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1a2639] border border-slate-200 dark:border-[#2a3c58] shadow-2xl py-2 z-40 animate-fadeIn divide-y divide-slate-100 dark:divide-[#243552]">
                        {/* Opção 1: Toggle Sugerir tópicos automaticamente */}
                        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Sugerir tópicos automaticamente
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !autoSuggestTopics;
                              setAutoSuggestTopics(next);
                              localStorage.setItem(
                                'alexandria_auto_suggest_topics',
                                String(next)
                              );
                            }}
                            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
                              autoSuggestTopics
                                ? 'bg-emerald-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                                autoSuggestTopics ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Opção 2: Recomeçar Ciclo */}
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOptionsMenuOpen(false);
                              setIsRestartConfirmOpen(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-between transition-colors"
                          >
                            <span>Recomeçar ciclo</span>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Opção 3: Excluir Planejamento */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsOptionsMenuOpen(false);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center justify-between transition-colors"
                          >
                            <span>Excluir planejamento</span>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Barra para Adicionar Disciplina no Modo Edição */}
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
                      step={5}
                      className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-400">min</span>
                    <button
                      type="button"
                      onClick={handleAddSession}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold shrink-0"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Card Destacado: PRÓXIMO ESTUDO (Quando fora do modo de edição) */}
              {!isEditMode && nextHighlightSession && (
                <div
                  onMouseEnter={() => setHoveredSession(nextHighlightSession.id)}
                  onMouseLeave={() => setHoveredSession(null)}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600/20 via-teal-600/15 to-emerald-500/10 border border-emerald-500/35 p-5 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <Link
                        href={`/materias/${encodeURIComponent(nextHighlightSession.subject)}`}
                        title={`Ir para ${nextHighlightSession.subject}`}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-md mt-0.5 hover:scale-105 transition-transform"
                        style={{ backgroundColor: nextHighlightSession.color || '#10b981' }}
                      >
                        <BookOpen className="w-5 h-5" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-900/80 text-emerald-400">
                            PRÓXIMO
                          </span>
                          {nextHighlightProgress > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              Em andamento ({nextHighlightPct}%)
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/materias/${encodeURIComponent(nextHighlightSession.subject)}`}
                          className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white hover:text-emerald-500 transition-colors truncate block"
                          title={`Abrir página da disciplina ${nextHighlightSession.subject}`}
                        >
                          {nextHighlightSession.subject}
                        </Link>
                        {autoSuggestTopics && nextSuggestedTopic && (
                          <div className="relative group/topic inline-flex items-center gap-1.5 max-w-full mt-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                openTopicSelectorForSubject(
                                  nextHighlightSession.subject,
                                  nextHighlightSession.color
                                )
                              }
                              className="text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-500 border-b border-dashed border-slate-400/50 hover:border-emerald-500 pb-0.5 truncate inline-flex items-center gap-1.5 max-w-full text-left transition-colors"
                            >
                              <span className="truncate">{nextSuggestedTopic}</span>
                              <Pencil className="w-3 h-3 shrink-0 opacity-75" />
                            </button>
                            {(() => {
                              const nbUrl = findTopicNotebookUrl(
                                subjects,
                                nextHighlightSession.subject,
                                nextSuggestedTopic
                              );
                              return nbUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = nbUrl.startsWith('http')
                                      ? nbUrl
                                      : `https://${nbUrl}`;
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                  }}
                                  title="Abrir Caderno de Questões deste tópico"
                                  className="p-1 rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              ) : null;
                            })()}
                            <div className="pointer-events-none opacity-0 group-hover/topic:opacity-100 transition-opacity duration-200 absolute bottom-full left-0 mb-2 w-60 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] font-medium text-center shadow-xl z-30">
                              Sugerido a partir do seu edital, na ordem dele. Toque para escolher outro.
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900/50 text-white">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            {nextHighlightProgress > 0
                              ? `Faltam ${formatMinutesToHoursMinutes(
                                  nextHighlightRemaining
                                )} (${formatMinutesToHoursMinutes(
                                  nextHighlightProgress
                                )} / ${formatMinutesToHoursMinutes(
                                  nextHighlightSession.duration
                                )})`
                              : formatMinutesToHoursMinutes(nextHighlightSession.duration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() =>
                          handleStartTimerForSession(
                            nextHighlightSession,
                            nextSuggestedTopic
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Iniciar estudo
                      </button>
                      <button
                        onClick={() =>
                          handleManualRegisterForSession(
                            nextHighlightSession,
                            nextSuggestedTopic
                          )
                        }
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-[#131f33] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#243552] hover:border-emerald-500 transition-colors"
                        title="Registrar Estudo Manual"
                      >
                        + Manual
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista: PRÓXIMOS ESTUDOS */}
              <div className="space-y-2.5">
                {!isEditMode && upcomingQueueSessions.length > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block pt-1">
                    Próximos Estudos
                  </span>
                )}

                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={studyCycle}
                      strategy={verticalListSortingStrategy}
                    >
                      {upcomingQueueSessions.length > 0 ? (
                        upcomingQueueSessions.map((session) => {
                          const sTopic = getSuggestedTopicForSubject(session.subject);
                          const sNotebookUrl = findTopicNotebookUrl(
                            subjects,
                            session.subject,
                            sTopic
                          );
                          return (
                            <SortableItem
                              key={session.id}
                              session={session}
                              suggestedTopic={sTopic}
                              notebookUrl={sNotebookUrl}
                              showSuggestedTopic={autoSuggestTopics}
                              hoveredSession={hoveredSession}
                              setHoveredSession={setHoveredSession}
                              sessionProgressMap={sessionProgressMap}
                              formatMinutesToHoursMinutes={formatMinutesToHoursMinutes}
                              onStartTimer={handleStartTimerForSession}
                              onManualRegister={handleManualRegisterForSession}
                              onOpenTopicSelector={openTopicSelectorForSubject}
                              isEditMode={isEditMode}
                              onDelete={handleDeleteSession}
                              onDuplicate={handleDuplicateSession}
                              onDurationChange={handleDurationChange}
                            />
                          );
                        })
                      ) : pendingSessions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-emerald-500 font-semibold bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-3">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <p>Parabéns! Você concluiu todos os blocos deste ciclo!</p>
                          <button
                            type="button"
                            onClick={restartStudyCycle}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Iniciar Novo Ciclo (+1 Ciclo Completo)
                          </button>
                        </div>
                      ) : null}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {/* Estudos Concluídos no Ciclo (Colapsável) */}
              {completedSessions.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-[#1f304a]">
                  <button
                    type="button"
                    onClick={() => setShowCompletedSection((prev) => !prev)}
                    className="w-full flex items-center justify-between py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Concluídos neste ciclo ({completedSessions.length})
                    </span>
                    {showCompletedSection ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showCompletedSection && (
                    <div className="space-y-2 mt-2">
                      {completedSessions.map((session) => {
                        const lastRec = studyRecords
                          .filter((r) => r.subject === session.subject)
                          .slice(-1)[0];
                        return (
                          <div
                            key={session.id}
                            className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between gap-4"
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

          {/* Coluna Direita (5 cols): Card Único "Distribuição do Ciclo" com Donut Duplo + Lista de Disciplinas (Estilo Estudei Print 8 & 9) */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Distribuição do Ciclo
              </h3>

              <div className="flex justify-center">
                <MultiRingDonutChart
                  cycle={studyCycle}
                  size={260}
                  completionPct={cycleCompletionPct}
                  studiedMinutes={totalProgressMinutes}
                  totalMinutes={totalCycleDuration}
                  hoveredSession={hoveredSession}
                  setHoveredSession={setHoveredSession}
                  sessionProgressMap={sessionProgressMap}
                  formatMinutesToHoursMinutes={formatMinutesToHoursMinutes}
                />
              </div>

              {/* Lista de Disciplinas do Ciclo (Estilo Estudei Print 9) */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#1f304a] space-y-2.5">
                {visibleSubjectsInChart.map((item) => (
                  <div
                    key={item.subject}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-[4px] shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.subject}
                      </span>
                      {item.count > 1 && (
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          {item.count}×
                        </span>
                      )}
                    </div>

                    <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                      {item.studiedMinutes > 0
                        ? `${formatMinutesToHoursMinutes(
                            item.studiedMinutes
                          )} / ${formatMinutesToHoursMinutes(item.plannedMinutes)}`
                        : formatMinutesToHoursMinutes(item.plannedMinutes)}
                    </span>
                  </div>
                ))}

                {subjectBreakdownList.length > 7 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSubjectsInChart((prev) => !prev)}
                    className="pt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    {showAllSubjectsInChart ? (
                      <>
                        <span>Ver menos</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>
                          Ver todas as {subjectBreakdownList.length} disciplinas
                        </span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
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
            Defina suas disciplinas, horas semanais, nível de domínio e peso na prova. O
            Krono organiza seus blocos e sugere automaticamente qual tópico do edital
            estudar em seguida.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all"
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
          setRecommendationJustification(null);
        }}
        onSave={handleSaveRecord}
        initialRecord={initialStudyRecord}
        justification={recommendationJustification}
        showDeleteButton={!!initialStudyRecord?.id}
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

      <ConfirmationModal
        isOpen={isRestartConfirmOpen}
        onClose={() => setIsRestartConfirmOpen(false)}
        onConfirm={() => {
          restartStudyCycle();
          showNotification('Ciclo de estudos reiniciado com sucesso!', 'success');
        }}
        title="Recomeçar Ciclo Atual?"
        message="Tem certeza que deseja zerar o progresso dos blocos atuais e recomeçar a fila deste ciclo do início? (Seus registros de estudo no histórico serão preservados)."
        confirmText="Sim, recomeçar ciclo"
        cancelText="Cancelar"
      />

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          resetStudyCycle();
          showNotification('Planejamento excluído com sucesso.', 'info');
        }}
        title="Excluir Planejamento?"
        message="Tem certeza que deseja excluir todo o planejamento de ciclo atual? Você poderá criar um novo planejamento quando quiser (seu histórico de estudos e edital continuarão salvos)."
        confirmText="Sim, excluir planejamento"
        cancelText="Cancelar"
      />

      {topicModalTarget && (
        <TopicQueueSelectorModal
          isOpen={!!topicModalTarget}
          onClose={() => setTopicModalTarget(null)}
          subjectName={topicModalTarget.subjectName}
          subjectColor={topicModalTarget.subjectColor}
          topics={topicModalTarget.topics}
          completedTopicNames={
            new Set(
              studyRecords
                .filter((r) => r.subject === topicModalTarget.subjectName && r.teoriaFinalizada)
                .map((r) => r.topic)
            )
          }
          currentSelectedTopic={topicModalTarget.currentTopic}
          onSelectTopic={() => setOverrideVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
