'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Clock,
  HelpCircle,
  Award,
  BookOpen,
  FileText,
  ExternalLink,
  History,
  ListTree,
  TrendingUp,
  Edit3,
  Trash2,
} from 'lucide-react';
import { getJsonContent, StudyRecord, updateTopicDetailsAction } from '../../actions';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../context/ThemeContext';
import { useNotification } from '../../../context/NotificationContext';
import StudyRegisterModal from '../../../components/StudyRegisterModal';
import TopicCockpitModal, { TopicMetadata } from '../../../components/TopicCockpitModal';
import Breadcrumbs from '../../../components/Breadcrumbs';
import { computeTopicScore } from '../../../lib/scoreEngine';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface PlanData {
  name: string;
  observations: string;
  cargo?: string;
  edital?: string;
  iconUrl?: string;
  subjects: Subject[];
}

interface Subject {
  subject: string;
  topics: Topic[];
  color: string;
}

interface Topic extends TopicMetadata {
  topic_number?: string;
  topic_text: string;
  is_grouping_topic?: boolean;
  is_completed?: boolean;
  sub_topics?: Topic[];
}

const formatTime = (milliseconds: number) => {
  if (isNaN(milliseconds) || milliseconds <= 0) {
    return '0h00min';
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
};

const countTopicsRecursively = (topics: Topic[]): number => {
  let count = 0;
  for (const topic of topics) {
    count++;
    if (topic.sub_topics && topic.sub_topics.length > 0) {
      count += countTopicsRecursively(topic.sub_topics);
    }
  }
  return count;
};

const countStudiedTopicsRecursively = (
  topics: Topic[],
  studiedTopicTexts: Set<string>
): number => {
  let count = 0;
  for (const topic of topics) {
    if (
      topic.is_completed ||
      topic.status === 'studied' ||
      studiedTopicTexts.has(topic.topic_text)
    ) {
      count++;
    }
    if (topic.sub_topics && topic.sub_topics.length > 0) {
      count += countStudiedTopicsRecursively(topic.sub_topics, studiedTopicTexts);
    }
  }
  return count;
};

const normalizePlanData = (data: PlanData | Subject[] | null, fileName: string): PlanData => {
  const defaultColor = '#10b981';

  if (Array.isArray(data)) {
    const subjectsWithColors = data.map((subject) => ({
      ...subject,
      color: subject.color || defaultColor,
    }));
    return {
      name: fileName
        .replace('.json', '')
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      observations: '',
      subjects: subjectsWithColors,
    };
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const subjectsWithColors = subjects.map((subject: Subject) => ({
      ...subject,
      color: subject.color || defaultColor,
    }));
    return {
      ...data,
      name:
        data.name ||
        fileName
          .replace('.json', '')
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      observations: data.observations || '',
      subjects: subjectsWithColors,
    };
  }

  return {
    name: fileName.replace('.json', ''),
    observations: '',
    subjects: [],
  };
};

export default function MateriaDetalhes() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subjectName = decodeURIComponent(params.subjectName as string);
  const initialFileName = searchParams.get('plan');

  const {
    studyRecords,
    addStudyRecord,
    updateStudyRecord,
    deleteStudyRecord,
    selectedDataFile,
    refreshPlans,
  } = useData();
  const { theme } = useTheme();
  const { showNotification } = useNotification();

  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StudyRecord | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ subject: string; topic: Topic } | null>(
    null
  );
  const [cockpitTopic, setCockpitTopic] = useState<Topic | null>(null);
  const [activeView, setActiveView] = useState<'edital' | 'historico' | 'evolucao'>('edital');
  const [activeChartRange, setActiveChartRange] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );
  const [allTopicsExpanded, setAllTopicsExpanded] = useState(true);

  const currentFile = selectedDataFile || initialFileName || '';

  const fetchPlan = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (currentFile) {
      const data = await getJsonContent(currentFile);
      if (data) {
        const normalizedData = normalizePlanData(data, currentFile);
        setPlanData(normalizedData);
      }
    }
    if (!silent) setLoading(false);
  }, [currentFile]);

  useEffect(() => {
    fetchPlan(false);
  }, [fetchPlan]);

  const filteredStudyRecords = useMemo(() => {
    return studyRecords.filter((record) => record.subject === subjectName);
  }, [studyRecords, subjectName]);

  const currentSubject = useMemo(() => {
    return planData?.subjects.find((s) => s.subject === subjectName);
  }, [planData, subjectName]);

  const totalTopicsCount = useMemo(() => {
    return countTopicsRecursively(currentSubject?.topics || []);
  }, [currentSubject]);

  const totalStudyTime = useMemo(() => {
    return filteredStudyRecords.reduce((acc, record) => acc + (record.studyTime || 0), 0);
  }, [filteredStudyRecords]);

  const totalCorrectQuestions = useMemo(() => {
    return filteredStudyRecords.reduce(
      (acc, record) => acc + (record.questions?.correct ?? (record as any).correctQuestions ?? 0),
      0
    );
  }, [filteredStudyRecords]);

  const totalIncorrectQuestions = useMemo(() => {
    return filteredStudyRecords.reduce((acc, record) => {
      if (record.questions && typeof record.questions.total === 'number') {
        return acc + (record.questions.total - (record.questions.correct || 0));
      }
      return acc + ((record as any).incorrectQuestions || 0);
    }, 0);
  }, [filteredStudyRecords]);

  const totalQuestions = totalCorrectQuestions + totalIncorrectQuestions;
  const performancePercentage =
    totalQuestions > 0 ? Math.round((totalCorrectQuestions / totalQuestions) * 100) : 0;

  const studiedTopics = useMemo(() => {
    const studiedTopicTexts = new Set(filteredStudyRecords.map((record) => record.topic));
    return countStudiedTopicsRecursively(currentSubject?.topics || [], studiedTopicTexts);
  }, [filteredStudyRecords, currentSubject]);

  const pendingTopics = Math.max(0, totalTopicsCount - studiedTopics);
  const progressPercentage =
    totalTopicsCount > 0 ? Math.round((studiedTopics / totalTopicsCount) * 100) : 0;

  const totalPagesRead = useMemo(() => {
    return filteredStudyRecords.reduce((acc, record) => {
      if (record.pagesRead) return acc + record.pagesRead;
      if (record.pages) {
        return (
          acc +
          record.pages.reduce((pageAcc, page) => pageAcc + (page.end - page.start + 1), 0)
        );
      }
      return acc;
    }, 0);
  }, [filteredStudyRecords]);

  const pagesReadPerHour =
    totalStudyTime > 0 ? (totalPagesRead / (totalStudyTime / 3600000)).toFixed(1) : '0.0';

  const handleSaveTopicCockpit = async (updatedTopic: TopicMetadata) => {
    if (!currentFile) return;
    // Atualiza imediatamente o tópico em memória para não perder as notas digitadas
    setCockpitTopic((prev) => (prev ? { ...prev, ...updatedTopic } : null));
    const res = await updateTopicDetailsAction(
      currentFile,
      subjectName,
      updatedTopic.topic_text,
      updatedTopic
    );
    if (res.success) {
      await fetchPlan(true);
      await refreshPlans();
    } else {
      showNotification(`Erro ao salvar tópico: ${res.error}`, 'error');
    }
  };

  const openRegisterModalForNew = () => {
    setSelectedTopic({
      subject: subjectName,
      topic: currentSubject?.topics?.[0] || { topic_text: '' },
    });
    setEditingRecord(null);
    setIsRegisterModalOpen(true);
  };

  const openRegisterModalForTopic = (topic: Topic) => {
    setSelectedTopic({ subject: subjectName, topic });
    setEditingRecord(null);
    setIsRegisterModalOpen(true);
  };

  const handleSaveStudy = (record: StudyRecord) => {
    if (editingRecord) {
      updateStudyRecord(record);
    } else {
      addStudyRecord(record);
    }
    setIsRegisterModalOpen(false);
    setEditingRecord(null);
    setSelectedTopic(null);
  };

  const handleEditRecord = (record: StudyRecord) => {
    setEditingRecord(record);
    setSelectedTopic(null);
    setIsRegisterModalOpen(true);
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      deleteStudyRecord(id);
    }
  };

  // Recursive Topic Row with Score & Cockpit trigger
  const TopicRow: React.FC<{
    topic: Topic;
    level: number;
  }> = ({ topic, level }) => {
    const [isExpanded, setIsExpanded] = useState(allTopicsExpanded);
    useEffect(() => {
      setIsExpanded(allTopicsExpanded);
    }, [allTopicsExpanded]);

    const topicRecords = useMemo(
      () => filteredStudyRecords.filter((r) => r.topic === topic.topic_text),
      [topic.topic_text]
    );

    const scoreRes = useMemo(() => {
      const mapped = topicRecords.map((r) => ({
        date: r.date,
        studyTime: r.studyTime || 0,
        questions: {
          correct: r.questions?.correct ?? (r as any).correctQuestions ?? 0,
          total:
            r.questions?.total ??
            ((r as any).correctQuestions || 0) + ((r as any).incorrectQuestions || 0),
        },
      }));
      return computeTopicScore(
        mapped,
        topic.relevance ?? 3,
        topic.difficulty ?? 3,
        topic.mastery ?? 3
      );
    }, [topicRecords, topic.relevance, topic.difficulty, topic.mastery]);

    const isStudied =
      topic.is_completed || topic.status === 'studied' || topicRecords.length > 0;
    const hasSubtopics = !!(topic.sub_topics && topic.sub_topics.length > 0);
    const hasNotes = !!(topic.notes && topic.notes.replace(/<[^>]*>/g, '').trim().length > 0);

    return (
      <>
        <tr className="group hover:bg-slate-50/80 dark:hover:bg-[#17263f]/60 transition-colors border-b border-slate-100 dark:border-[#1f304a]">
          <td
            className="py-3 px-4 text-xs text-slate-800 dark:text-slate-100"
            style={{ paddingLeft: `${level * 22 + 20}px` }}
          >
            <div className="flex items-center gap-2">
              {hasSubtopics ? (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {topic.topic_number && (
                <span className="font-mono text-[11px] font-bold text-emerald-500 shrink-0">
                  {topic.topic_number}
                </span>
              )}

              <button
                onClick={() => setCockpitTopic(topic)}
                className={`text-left hover:text-emerald-500 transition-colors ${
                  hasSubtopics ? 'font-bold' : 'font-medium'
                }`}
              >
                {topic.topic_text}
              </button>

              {hasNotes && (
                <span
                  onClick={() => setCockpitTopic(topic)}
                  className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold"
                  title="Possui resumo/anotações"
                >
                  <FileText className="w-3 h-3" />
                  Notas
                </span>
              )}

              {topic.notebookUrl && (
                <a
                  href={topic.notebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20"
                  title="Abrir Caderno de Questões"
                >
                  <ExternalLink className="w-3 h-3" />
                  Caderno
                </a>
              )}
            </div>
          </td>

          <td className="py-3 px-4 whitespace-nowrap text-xs">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isStudied
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-slate-100 dark:bg-[#0b1320] text-slate-400'
              }`}
            >
              {isStudied ? 'Concluído' : 'Pendente'}
            </span>
          </td>

          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            {scoreRes.totalQuestions > 0 ? (
              <span>
                <strong className="text-emerald-500">{scoreRes.correctQuestions}</strong>/
                {scoreRes.totalQuestions} ({Math.round(scoreRes.rawAccuracy * 100)}%)
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>

          <td className="py-3 px-4 whitespace-nowrap">
            {isStudied ? (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                  scoreRes.color === 'emerald'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : scoreRes.color === 'amber'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {scoreRes.currentScore} pts
              </span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>

          <td className="py-3 px-6 text-right whitespace-nowrap">
            <div className="inline-flex items-center gap-1.5">
              <button
                onClick={() => setCockpitTopic(topic)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                title="Abrir Cockpit de Anotações e Score"
              >
                Cockpit / Notas
              </button>
              <button
                onClick={() => openRegisterModalForTopic(topic)}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                title="Registrar Estudo neste Tópico"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded &&
          hasSubtopics &&
          topic.sub_topics!.map((sub, idx) => (
            <TopicRow key={`${sub.topic_text}-${idx}`} topic={sub} level={level + 1} />
          ))}
      </>
    );
  };

  // Chart data
  const chartData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredStudyRecords.forEach((record) => {
      const d = new Date(record.date);
      let key = d.toISOString().split('T')[0];
      if (activeChartRange === 'weekly') {
        const start = new Date(d.setDate(d.getDate() - d.getDay()));
        key = start.toISOString().split('T')[0];
      } else if (activeChartRange === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      map[key] = (map[key] || 0) + (record.studyTime || 0);
    });
    const sorted = Object.keys(map)
      .sort()
      .map((date) => ({ date, hours: +(map[date] / 3600000).toFixed(2) }));

    return {
      labels: sorted.map((d) => d.date),
      datasets: [
        {
          label: 'Horas de Estudo',
          data: sorted.map((d) => d.hours),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.3,
        },
      ],
    };
  }, [filteredStudyRecords, activeChartRange]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentSubject) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-slate-400 mb-4">Disciplina não encontrada neste plano.</p>
        <Link
          href="/materias"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Disciplinas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Bar with Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Disciplinas', href: '/materias' },
              {
                label: subjectName,
                onClick: () => setActiveView('edital'),
              },
              ...(activeView === 'historico'
                ? [{ label: 'Histórico' }]
                : activeView === 'evolucao'
                ? [{ label: 'Evolução' }]
                : []),
            ]}
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <span
              className="w-3.5 h-8 rounded-full"
              style={{ backgroundColor: currentSubject.color || '#10b981' }}
            />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {subjectName}
            </h1>
          </div>
        </div>

        <button
          onClick={openRegisterModalForNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all self-start sm:self-center"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Registrar Estudo
        </button>
      </div>

      {/* 4 Sleek KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tempo de Estudo
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatTime(totalStudyTime)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {filteredStudyRecords.length} sessões registradas
          </p>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Desempenho
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-500">
            {performancePercentage}%
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalCorrectQuestions} acertos de {totalQuestions} questões
          </p>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Progresso no Edital
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {progressPercentage}%
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {studiedTopics} concluídos • {pendingTopics} pendentes
          </p>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Leitura / PDF
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalPagesRead} págs
          </div>
          <p className="text-xs text-slate-400 mt-1">Ritmo: {pagesReadPerHour} páginas/hora</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1f304a]">
        <button
          onClick={() => setActiveView('edital')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeView === 'edital'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ListTree className="w-4 h-4" />
          Edital Verticalizado ({totalTopicsCount})
        </button>

        <button
          onClick={() => setActiveView('historico')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeView === 'historico'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Estudos ({filteredStudyRecords.length})
        </button>

        <button
          onClick={() => setActiveView('evolucao')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
            activeView === 'evolucao'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Evolução no Tempo
        </button>
      </div>

      {/* Tab Content 1: Edital Verticalizado da Disciplina */}
      {activeView === 'edital' && (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#1f304a] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tópicos e Subtópicos de {subjectName}
              </h2>
              <p className="text-xs text-slate-400">
                Clique em qualquer tópico para abrir o Cockpit com Editor de Resumos, Caderno de Questões e Score
              </p>
            </div>
            <button
              onClick={() => setAllTopicsExpanded((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
            >
              {allTopicsExpanded ? 'Recolher Subtópicos' : 'Expandir Todos'}
            </button>
          </div>

          {currentSubject.topics.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Nenhum tópico cadastrado para esta disciplina.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-6">Tópico</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Questões</th>
                    <th className="py-3 px-4">Score Bússola</th>
                    <th className="py-3 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSubject.topics.map((topic, index) => (
                    <TopicRow key={`${topic.topic_text}-${index}`} topic={topic} level={0} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Histórico de Registros */}
      {activeView === 'historico' && (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm">
          {filteredStudyRecords.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-400 mb-4">
                Nenhum registro de estudo para esta disciplina ainda.
              </p>
              <button
                onClick={openRegisterModalForNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Adicionar Primeiro Registro
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-6">Data</th>
                    <th className="py-3.5 px-4">Tópico</th>
                    <th className="py-3.5 px-4">Tempo</th>
                    <th className="py-3.5 px-4">Acertos / Erros</th>
                    <th className="py-3.5 px-4">Páginas</th>
                    <th className="py-3.5 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f304a]">
                  {filteredStudyRecords.map((record, index) => {
                    const c = record.questions?.correct ?? (record as any).correctQuestions ?? 0;
                    const inc =
                      record.questions?.total !== undefined
                        ? record.questions.total - c
                        : (record as any).incorrectQuestions ?? 0;
                    return (
                      <tr
                        key={record.id || index}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#17263f]/60 transition-colors text-xs"
                      >
                        <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {new Date(record.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                          {record.topic}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatTime(record.studyTime)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-emerald-500 font-bold">{c}</span> /{' '}
                          <span className="text-rose-400 font-bold">{inc}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {record.pagesRead || '—'}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 mr-1"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 3: Evolução no Tempo */}
      {activeView === 'evolucao' && (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Evolução das Horas de Estudo
            </h2>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#0b1320] p-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveChartRange(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    activeChartRange === tab
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab === 'daily' ? 'Diário' : tab === 'weekly' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            {filteredStudyRecords.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                Sem registros suficientes para exibir o gráfico.
              </div>
            ) : (
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    x: {
                      ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
                      grid: { display: false },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' },
                      grid: { color: theme === 'dark' ? '#1f304a' : '#e2e8f0' },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Study Register Modal */}
      <StudyRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingRecord(null);
          setSelectedTopic(null);
        }}
        onSave={handleSaveStudy}
        initialRecord={editingRecord}
        topic={selectedTopic}
        showDeleteButton={!!editingRecord?.id}
      />

      {/* Topic Cockpit Modal (Notes Editor + Score + External QConcursos/TEC Link) */}
      {cockpitTopic && (
        <TopicCockpitModal
          isOpen={!!cockpitTopic}
          onClose={() => setCockpitTopic(null)}
          subjectName={subjectName}
          subjectColor={currentSubject.color}
          topic={cockpitTopic}
          studyRecords={filteredStudyRecords}
          onSaveTopic={handleSaveTopicCockpit}
        />
      )}
    </div>
  );
}
