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
  Check,
  Activity,
  Sparkles,
} from 'lucide-react';
import {
  getJsonContent,
  StudyRecord,
  updateTopicDetailsAction,
  addSubtopicAction,
} from '../../actions';
import { useData } from '../../../context/DataContext';
import { useTheme } from '../../../context/ThemeContext';
import { useNotification } from '../../../context/NotificationContext';
import StudyRegisterModal from '../../../components/StudyRegisterModal';
import TopicCockpitModal, { TopicMetadata } from '../../../components/TopicCockpitModal';
import Breadcrumbs from '../../../components/Breadcrumbs';
import {
  computeTopicScore,
  computeSubjectScore,
  findTopicNotebookUrl,
} from '../../../lib/scoreEngine';

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
    if (!topic.sub_topics || topic.sub_topics.length === 0) {
      count++;
    } else {
      count += countTopicsRecursively(topic.sub_topics);
    }
  }
  return count;
};

const countStudiedTopicsRecursively = (
  topics: Topic[],
  completedTopicTexts: Set<string>
): number => {
  let count = 0;
  for (const topic of topics) {
    if (!topic.sub_topics || topic.sub_topics.length === 0) {
      if (
        topic.is_completed ||
        topic.status === 'completed' ||
        topic.status === 'studied' ||
        completedTopicTexts.has(topic.topic_text)
      ) {
        count++;
      }
    } else {
      count += countStudiedTopicsRecursively(topic.sub_topics, completedTopicTexts);
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
    simuladoRecords,
    addStudyRecord,
    updateStudyRecord,
    deleteStudyRecord,
    selectedDataFile,
    studyPlans,
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
  const [historyFilterMode, setHistoryFilterMode] = useState<'all' | 'revisions' | 'by_topic'>(
    'all'
  );
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

  const normalizedSubjectName = useMemo(
    () => (subjectName || '').trim().toLowerCase(),
    [subjectName]
  );

  const filteredStudyRecords = useMemo(() => {
    return (studyRecords || []).filter(
      (record) => (record.subject || '').trim().toLowerCase() === normalizedSubjectName
    );
  }, [studyRecords, normalizedSubjectName]);

  const currentSubject = useMemo(() => {
    if (!normalizedSubjectName) return null;
    // 1. Tenta no planData local
    const foundInLocal = planData?.subjects?.find(
      (s) => (s.subject || '').trim().toLowerCase() === normalizedSubjectName
    );
    if (foundInLocal) return foundInLocal;

    // 2. Tenta nos studyPlans carregados globalmente no DataContext
    for (const plan of studyPlans || []) {
      const subs = Array.isArray(plan) ? plan : plan?.subjects;
      const foundInGlobal = (subs || []).find(
        (s: any) => (s.subject || '').trim().toLowerCase() === normalizedSubjectName
      );
      if (foundInGlobal) return foundInGlobal;
    }
    return null;
  }, [planData, studyPlans, normalizedSubjectName]);

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

  const completedTopicTextsSet = useMemo(() => {
    return new Set(
      filteredStudyRecords
        .filter((r) => r.teoriaFinalizada)
        .map((record) => record.topic)
    );
  }, [filteredStudyRecords]);

  const studiedTopics = useMemo(() => {
    return countStudiedTopicsRecursively(
      currentSubject?.topics || [],
      completedTopicTextsSet
    );
  }, [completedTopicTextsSet, currentSubject]);

  const subjectScoreObj = useMemo(() => {
    return computeSubjectScore({
      subjectName,
      topics: currentSubject?.topics || [],
      studyRecords: studyRecords || [],
      simuladoRecords: simuladoRecords || [],
    });
  }, [subjectName, currentSubject?.topics, studyRecords, simuladoRecords]);

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

  const handleToggleTopicCompletion = async (topicNode: Topic, currentlyCompleted: boolean) => {
    const nextState = !currentlyCompleted;
    const leafNames: string[] = [];
    const allNames: string[] = [];
    const collect = (node: Topic) => {
      allNames.push(node.topic_text);
      if (!node.sub_topics || node.sub_topics.length === 0) {
        leafNames.push(node.topic_text);
      } else {
        node.sub_topics.forEach(collect);
      }
    };
    collect(topicNode);

    if (nextState) {
      for (const leafName of leafNames) {
        const recs = filteredStudyRecords.filter((r) => r.topic === leafName);
        if (recs.length > 0) {
          for (const rec of recs) {
            if (!rec.teoriaFinalizada) {
              await updateStudyRecord({ ...rec, teoriaFinalizada: true });
            }
          }
        } else {
          await addStudyRecord({
            date: new Date().toISOString().split('T')[0],
            subjectId: (currentSubject as any)?.id || '',
            subject: subjectName,
            topic: leafName,
            studyTime: 0,
            questions: { correct: 0, total: 0 },
            pages: [],
            videos: [],
            notes: '',
            category: 'teoria',
            teoriaFinalizada: true,
            countInPlanning: false,
          });
        }
      }
    } else {
      const matching = filteredStudyRecords.filter((r) => allNames.includes(r.topic));
      for (const rec of matching) {
        if (rec.teoriaFinalizada) {
          await updateStudyRecord({ ...rec, teoriaFinalizada: false });
        }
      }
    }

    if (currentFile) {
      for (const tName of allNames) {
        await updateTopicDetailsAction(currentFile, subjectName, tName, {
          is_completed: nextState,
          status: nextState ? 'completed' : 'not_started',
        });
      }
      await fetchPlan(true);
      await refreshPlans();
    }
  };

  const handleAddSubtopic = async (parentTopicText: string) => {
    if (!currentFile) {
      showNotification('Nenhum plano selecionado.', 'error');
      return;
    }
    const name = window.prompt(`Nome do novo subtópico dentro de "${parentTopicText}":`);
    if (!name || !name.trim()) return;
    const res = await addSubtopicAction(currentFile, subjectName, parentTopicText, name.trim());
    if (res.success) {
      showNotification('Subtópico adicionado com sucesso!', 'success');
      await fetchPlan(true);
      await refreshPlans();
    } else {
      showNotification(res.error || 'Erro ao adicionar subtópico.', 'error');
    }
  };

  const errorReasonsStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalTags = 0;
    for (const r of filteredStudyRecords) {
      const reasons = r.errorReasons || (r.questions as any)?.errorReasons || [];
      if (Array.isArray(reasons)) {
        for (const reason of reasons) {
          counts[reason] = (counts[reason] || 0) + 1;
          totalTags++;
        }
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0,
      }));
    return { sorted, totalTags };
  }, [filteredStudyRecords]);

  // Recursive Topic Row with Score, Retention & Cockpit trigger
  const TopicRow: React.FC<{
    topic: Topic;
    level: number;
  }> = ({ topic, level }) => {
    const [isExpanded, setIsExpanded] = useState(allTopicsExpanded);
    useEffect(() => {
      setIsExpanded(allTopicsExpanded);
    }, [allTopicsExpanded]);

    const isLeafCompleted = (t: Topic): boolean => {
      if (!t.sub_topics || t.sub_topics.length === 0) {
        return Boolean(
          t.is_completed ||
            t.status === 'completed' ||
            t.status === 'studied' ||
            completedTopicTextsSet.has(t.topic_text)
        );
      }
      return t.sub_topics.every(isLeafCompleted);
    };

    const isCompleted = isLeafCompleted(topic);

    const getAllDescendantTopicTexts = useCallback((t: Topic): string[] => {
      let texts = [t.topic_text.trim().toLowerCase()];
      if (t.sub_topics && t.sub_topics.length > 0) {
        for (const sub of t.sub_topics) {
          texts = texts.concat(getAllDescendantTopicTexts(sub));
        }
      }
      return texts;
    }, []);

    const topicRecords = useMemo(() => {
      const targetTexts = new Set(getAllDescendantTopicTexts(topic));
      return filteredStudyRecords.filter((r) => {
        const rTop = (r.topic || '').trim().toLowerCase();
        if (targetTexts.has(rTop)) return true;
        return Array.from(targetTexts).some(
          (tt) =>
            (rTop.length > 5 && (rTop.endsWith(tt) || tt.endsWith(rTop))) ||
            (rTop.length > 8 && (rTop.includes(tt) || tt.includes(rTop)))
        );
      });
    }, [filteredStudyRecords, topic, getAllDescendantTopicTexts]);

    const scoreRes = useMemo(() => {
      return computeTopicScore(
        topicRecords,
        topic.relevance ?? 3,
        topic.difficulty ?? 3,
        topic.perceivedMastery ?? topic.mastery ?? 3,
        {
          subjectRecords: filteredStudyRecords,
          allStudyRecords: studyRecords || [],
          simuladoRecords: simuladoRecords || [],
          subjectName,
          topicText: topic.topic_text,
          isCompleted,
          hasNotes: Boolean(topic.notes && String(topic.notes).replace(/<[^>]*>/g, '').trim().length > 0),
        }
      );
    }, [
      topicRecords,
      topic.relevance,
      topic.difficulty,
      topic.perceivedMastery,
      topic.mastery,
      topic.notes,
      topic.topic_text,
      filteredStudyRecords,
      studyRecords,
      simuladoRecords,
      subjectName,
      isCompleted,
    ]);

    const hasStudiedData = isCompleted || topicRecords.length > 0;
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

              <button
                type="button"
                onClick={() => handleToggleTopicCompletion(topic, isCompleted)}
                className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 bg-white dark:bg-[#0b1320]'
                }`}
                title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluído'}
              >
                {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
              </button>

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
                isCompleted
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-slate-100 dark:bg-[#0b1320] text-slate-400'
              }`}
            >
              {isCompleted ? 'Concluído' : 'Pendente'}
            </span>
          </td>

          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
            {scoreRes.totalQuestions > 0 ? (
              <span>
                <strong className="text-emerald-500">{scoreRes.correctQuestions}</strong>/
                {scoreRes.totalQuestions}{' '}
                (
                {scoreRes.rawAccuracy !== null
                  ? scoreRes.rawAccuracy <= 1
                    ? Math.round(scoreRes.rawAccuracy * 100)
                    : Math.round(scoreRes.rawAccuracy)
                  : 0}
                %)
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>

          <td className="py-3 px-4 whitespace-nowrap">
            {hasStudiedData ? (
              <button
                type="button"
                onClick={() => setCockpitTopic(topic)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border transition-transform hover:scale-105 ${
                  scoreRes.color === 'emerald'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : scoreRes.color === 'amber'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                <span>{scoreRes.currentScore} pts</span>
                <span className="opacity-75 font-semibold text-[10px]">
                  ({scoreRes.retention}% ret.)
                </span>
              </button>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>

          <td className="py-3 px-6 text-right whitespace-nowrap">
            <div className="inline-flex items-center gap-1.5">
              {level < 2 && (
                <button
                  onClick={() => handleAddSubtopic(topic.topic_text)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-[#0b1320] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-500 border border-slate-200 dark:border-[#1f304a] transition-colors"
                  title="Adicionar subtópico dentro deste item"
                >
                  + Sub
                </button>
              )}
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

      {/* 5 Sleek KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Score & Retenção
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-500">
              {subjectScoreObj.subjectScore} pts
            </span>
            <span className="text-xs font-bold text-indigo-400">
              • {subjectScoreObj.subjectRetention}% ret.
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {subjectScoreObj.simuladoQuestionsTotal > 0
              ? `Inclui ${subjectScoreObj.simuladoQuestionsTotal} questões de simulados`
              : 'Baseado nos tópicos e histórico'}
          </p>
        </div>

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
          Desempenho & Evolução
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

      {/* Tab Content 2: Histórico de Registros & Histórico de Revisões por Tópico */}
      {activeView === 'historico' && (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm">
          {/* Sub-barra de filtro do Histórico da Disciplina */}
          <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#1f304a] flex flex-wrap items-center justify-between gap-3 bg-slate-50/40 dark:bg-[#0f1929]/40">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0f1826] p-1 rounded-xl border border-slate-200/80 dark:border-[#1f304a]">
              <button
                type="button"
                onClick={() => setHistoryFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyFilterMode === 'all'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todas as Sessões ({filteredStudyRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterMode('revisions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyFilterMode === 'revisions'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Apenas Revisões (
                {filteredStudyRecords.filter((r) => r.category === 'revisao').length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilterMode('by_topic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyFilterMode === 'by_topic'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Histórico por Tópico
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              Acompanhe revisões, sessões de estudo e acesse o Caderno de Questões de cada tópico
            </span>
          </div>

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
          ) : historyFilterMode === 'by_topic' ? (
            <div className="divide-y divide-slate-100 dark:divide-[#1f304a] p-5 space-y-4">
              {Array.from(
                filteredStudyRecords.reduce((acc, rec) => {
                  const key = rec.topic || 'Tópico Geral';
                  const list = acc.get(key) || [];
                  list.push(rec);
                  acc.set(key, list);
                  return acc;
                }, new Map<string, StudyRecord[]>())
              ).map(([topicName, recs]) => {
                const nbUrl = findTopicNotebookUrl(
                  planData?.subjects || [],
                  subjectName,
                  topicName
                );
                const revCount = recs.filter((r) => r.category === 'revisao').length;
                const totalQ = recs.reduce((s, r) => s + (r.questions?.total || 0), 0);
                const totalC = recs.reduce((s, r) => s + (r.questions?.correct || 0), 0);
                const accPct = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;
                return (
                  <div
                    key={topicName}
                    className="pt-4 first:pt-0 rounded-xl border border-slate-200/70 dark:border-[#1f304a] p-4 bg-slate-50/40 dark:bg-[#0f1826]/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {topicName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
                          {revCount} {revCount === 1 ? 'revisão' : 'revisões'} • {recs.length}{' '}
                          {recs.length === 1 ? 'sessão' : 'sessões'}
                        </span>
                        {accPct !== null && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            {totalC}/{totalQ} ({accPct}%)
                          </span>
                        )}
                      </div>
                      {nbUrl && (
                        <a
                          href={nbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-bold transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir Caderno de Questões
                        </a>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {recs.map((r, idx) => {
                        const qT = r.questions?.total || 0;
                        const qC = r.questions?.correct || 0;
                        const qP = qT > 0 ? Math.round((qC / qT) * 100) : null;
                        return (
                          <div
                            key={r.id || idx}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/60 dark:border-[#1f304a]/80 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {new Date(r.date).toLocaleDateString('pt-BR')}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  r.category === 'revisao'
                                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                                    : r.category === 'questoes'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                                }`}
                              >
                                {r.category === 'revisao'
                                  ? 'Revisão'
                                  : r.category === 'questoes'
                                  ? 'Questões'
                                  : 'Teoria'}
                              </span>
                              {r.comments && (
                                <span className="text-[11px] text-slate-400 italic truncate max-w-xs">
                                  “{r.comments}”
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">{formatTime(r.studyTime)}</span>
                              {qP !== null && (
                                <span className="font-bold text-emerald-500">
                                  {qC}/{qT} ({qP}%)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-6">Data</th>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-4">Tópico</th>
                    <th className="py-3.5 px-4">Tempo</th>
                    <th className="py-3.5 px-4">Acertos / Erros</th>
                    <th className="py-3.5 px-4">Caderno</th>
                    <th className="py-3.5 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f304a]">
                  {filteredStudyRecords
                    .filter((r) =>
                      historyFilterMode === 'revisions' ? r.category === 'revisao' : true
                    )
                    .map((record, index) => {
                      const c =
                        record.questions?.correct ?? (record as any).correctQuestions ?? 0;
                      const inc =
                        record.questions?.total !== undefined
                          ? record.questions.total - c
                          : (record as any).incorrectQuestions ?? 0;
                      const nbUrl = findTopicNotebookUrl(
                        planData?.subjects || [],
                        subjectName,
                        record.topic
                      );
                      return (
                        <tr
                          key={record.id || index}
                          className="hover:bg-slate-50/80 dark:hover:bg-[#17263f]/60 transition-colors text-xs"
                        >
                          <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {new Date(record.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                record.category === 'revisao'
                                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                                  : record.category === 'questoes'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                              }`}
                            >
                              {record.category === 'revisao'
                                ? 'Revisão'
                                : record.category === 'questoes'
                                ? 'Questões'
                                : 'Teoria'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                            {record.topic}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {formatTime(record.studyTime)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div>
                              <span className="text-emerald-500 font-bold">{c}</span> /{' '}
                              <span className="text-rose-400 font-bold">{inc}</span>
                            </div>
                            {Array.isArray(record.errorReasons) && record.errorReasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {record.errorReasons.map((er) => (
                                  <span
                                    key={er}
                                    className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold"
                                  >
                                    {er}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {nbUrl ? (
                              <a
                                href={nbUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition-colors"
                                title="Abrir Caderno de Questões"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Caderno
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
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

      {/* Tab Content 3: Desempenho & Evolução no Tempo */}
      {activeView === 'evolucao' && (
        <div className="space-y-6">
          {/* Painel de Desempenho Consolidado da Disciplina */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200/80 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 block">
                Score Geral da Disciplina
              </span>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                {subjectScoreObj.subjectScore} <span className="text-sm text-slate-400">/ 100 pts</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Combina tópicos estudados ({subjectScoreObj.topicsEvaluated}/{subjectScoreObj.totalTopics}), questões e simulados
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200/80 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
                Retenção Ativa da Disciplina
              </span>
              <div className="text-3xl font-extrabold text-indigo-400 mt-1">
                {subjectScoreObj.subjectRetention}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Último estudo registrado há {subjectScoreObj.daysSinceLastStudy} dias
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200/80 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                Questões em Simulados vs Estudos
              </span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1.5">
                Estudos: {subjectScoreObj.studyQuestionsCorrect}/{subjectScoreObj.studyQuestionsTotal} • Simulados:{' '}
                {subjectScoreObj.simuladoQuestionsCorrect}/{subjectScoreObj.simuladoQuestionsTotal}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Aproveitamento combinado: {subjectScoreObj.combinedAccuracyPct}%
              </p>
            </div>
          </div>

          {/* Diagnóstico de Motivos de Erro na Disciplina */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200/80 dark:border-[#1f304a] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                  Diagnóstico de Motivos de Erro em {subjectName}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {errorReasonsStats.totalTags > 0
                    ? `Principal causa registrada: ${errorReasonsStats.sorted[0].reason} (${errorReasonsStats.sorted[0].pct}% das marcações)`
                    : 'Ao errar questões no modal de registro, selecione as tags rápidas de motivo do erro para ver o diagnóstico aqui.'}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {errorReasonsStats.totalTags} marcações
              </span>
            </div>
            {errorReasonsStats.sorted.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {errorReasonsStats.sorted.map((item) => (
                  <div
                    key={item.reason}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/70 dark:border-[#1f304a] flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {item.reason}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.count} {item.count === 1 ? 'sessão' : 'sessões'} com esse erro
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 font-extrabold text-xs">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução das Horas de Estudo em {subjectName}
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
