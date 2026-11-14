'use client';

import React from 'react';
import Link from 'next/link';
import { useData, HierarchicalPerformanceNode, StudyRecord } from '../../context/DataContext';
import { computeTopicScore } from '../../lib/scoreEngine';
import {
  Plus,
  Filter,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Video,
  Flame,
  ListChecks,
  Award,
  AlertTriangle,
  Calendar,
  Target,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import ChartComponents from '../../components/ChartComponents';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import FilterModal from '../../components/FilterModal';
import CategoryHoursChart from '../../components/CategoryHoursChart';
import { Line, Bar } from 'react-chartjs-2';
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
  BarElement,
  RadialLinearScale,
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
  TimeScale,
  BarElement,
  RadialLinearScale
);

export default function Estatisticas() {
  const {
    stats,
    studyRecords,
    simuladoRecords,
    addStudyRecord,
    updateStudyRecord,
    applyFilters,
    availableSubjects,
    availableCategories,
  } = useData();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<StudyRecord | null>(null);
  const [allTopicsExpanded, setAllTopicsExpanded] = React.useState(true);
  const [subjectSortOrder, setSubjectSortOrder] = React.useState<'desc' | 'asc' | 'alpha'>(
    'desc'
  );
  const [examDate, setExamDate] = React.useState<string>('');
  const [selectedErrorSubject, setSelectedErrorSubject] = React.useState<string>('ALL');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('krono_exam_date');
      if (saved) setExamDate(saved);
    }
  }, []);

  const handleExamDateChange = (val: string) => {
    setExamDate(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('krono_exam_date', val);
    }
  };

  // 1. Projeção Matemática de Fechamento do Edital ("Termômetro até a Prova")
  const editalProjection = React.useMemo(() => {
    const total = stats.totalTopics || 0;
    const completed = stats.completedTopics || 0;
    const pending = Math.max(0, total - completed);
    const activeWeeks = Math.max(1, (stats.totalDaysSinceFirstRecord || 7) / 7);
    const topicsPerWeek = completed > 0 ? +(completed / activeWeeks).toFixed(1) : 0;
    const avgMinutesPerTopic =
      completed > 0
        ? Math.round(stats.totalStudyTime / 60000 / completed)
        : 90; // fallback 90 min por tópico

    const weeksNeededAtCurrentPace =
      topicsPerWeek > 0 ? pending / topicsPerWeek : null;
    const predictedFinishDate =
      weeksNeededAtCurrentPace !== null
        ? new Date(Date.now() + weeksNeededAtCurrentPace * 7 * 86400000)
        : null;

    let daysUntilExam: number | null = null;
    let requiredTopicsPerWeek: number | null = null;
    let requiredMinutesPerDay: number | null = null;
    let onTrack: boolean | null = null;

    if (examDate) {
      const targetMs = new Date(examDate + 'T23:59:59').getTime();
      const diffDays = Math.ceil((targetMs - Date.now()) / 86400000);
      if (diffDays > 0) {
        daysUntilExam = diffDays;
        const weeksUntilExam = Math.max(0.5, diffDays / 7);
        requiredTopicsPerWeek = +(pending / weeksUntilExam).toFixed(1);
        requiredMinutesPerDay = Math.round((pending * avgMinutesPerTopic) / diffDays);
        onTrack =
          predictedFinishDate !== null
            ? predictedFinishDate.getTime() <= targetMs
            : pending === 0;
      }
    }

    return {
      total,
      completed,
      pending,
      topicsPerWeek,
      avgMinutesPerTopic,
      predictedFinishDate,
      daysUntilExam,
      requiredTopicsPerWeek,
      requiredMinutesPerDay,
      onTrack,
    };
  }, [stats, examDate]);

  // 2. Raio-X de "Pontos Cegos de Alto Risco" (Matriz Relevância x Score)
  const blindSpots = React.useMemo(() => {
    const items: Array<{
      subject: string;
      topic: string;
      relevance: number;
      difficulty: number;
      currentScore: number;
      retention: number;
      totalQuestions: number;
      priorityROI: number;
      studied: boolean;
    }> = [];

    const allRecs = studyRecords || [];
    const simRecs = simuladoRecords || [];

    const collectLeaves = (topics: any[]): any[] => {
      let leaves: any[] = [];
      for (const t of topics || []) {
        if (t.sub_topics && t.sub_topics.length > 0) {
          leaves = leaves.concat(collectLeaves(t.sub_topics));
        } else {
          leaves.push(t);
        }
      }
      return leaves;
    };

    for (const subj of stats.editalData || []) {
      const subjName = subj.subject;
      const subjRecs = allRecs.filter(
        (r) => (r.subject || '').trim().toLowerCase() === (subjName || '').trim().toLowerCase()
      );
      const leaves = collectLeaves(subj.topics || []);

      for (const leaf of leaves) {
        const rel = leaf.relevance ?? 3;
        const diff = leaf.difficulty ?? 3;
        const mast = leaf.perceivedMastery ?? leaf.mastery ?? 3;
        const tText = leaf.topic_text || '';
        const tRecs = subjRecs.filter(
          (r) => (r.topic || '').trim().toLowerCase() === tText.trim().toLowerCase()
        );
        const isComp = Boolean(
          leaf.is_completed ||
            leaf.status === 'completed' ||
            tRecs.some((r) => r.teoriaFinalizada)
        );
        const scoreRes = computeTopicScore(tRecs, rel, diff, mast, {
          subjectRecords: subjRecs,
          allStudyRecords: allRecs,
          simuladoRecords: simRecs,
          subjectName: subjName,
          topicText: tText,
          isCompleted: isComp,
        });

        const studied = isComp || tRecs.length > 0;
        // Ponto cego: alta relevância (>= 4, ou >= 3 se estudado com score baixo) e score < 68 ou poucas questões (< 15)
        if (
          (rel >= 4 && (!studied || scoreRes.currentScore < 70 || scoreRes.totalQuestions < 15)) ||
          (rel >= 3 && studied && scoreRes.currentScore < 62)
        ) {
          items.push({
            subject: subjName,
            topic: tText,
            relevance: rel,
            difficulty: diff,
            currentScore: studied ? scoreRes.currentScore : 0,
            retention: studied ? scoreRes.retention : 0,
            totalQuestions: scoreRes.totalQuestions,
            priorityROI: scoreRes.priorityROI,
            studied,
          });
        }
      }
    }

    return items
      .sort((a, b) => {
        if (b.relevance !== a.relevance) return b.relevance - a.relevance;
        return b.priorityROI - a.priorityROI;
      })
      .slice(0, 12);
  }, [stats.editalData, studyRecords, simuladoRecords]);

  // 3. Diagnóstico de Motivos de Erro (Global e por Disciplina)
  const errorDiagnosis = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const subjectsWithErrors = new Set<string>();
    let totalMarks = 0;

    for (const r of studyRecords || []) {
      const reasons = r.errorReasons || (r.questions as any)?.errorReasons || [];
      if (Array.isArray(reasons) && reasons.length > 0) {
        if (r.subject) subjectsWithErrors.add(r.subject);
        if (selectedErrorSubject === 'ALL' || r.subject === selectedErrorSubject) {
          for (const reason of reasons) {
            counts[reason] = (counts[reason] || 0) + 1;
            totalMarks++;
          }
        }
      }
    }

    const breakdown = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        reason,
        count,
        pct: totalMarks > 0 ? Math.round((count / totalMarks) * 100) : 0,
      }));

    return {
      breakdown,
      totalMarks,
      subjectsList: Array.from(subjectsWithErrors).sort(),
    };
  }, [studyRecords, selectedErrorSubject]);

  // 4. Produtividade por Dia da Semana (Melhor Dia de Rendimento)
  const weekdayPerformance = React.useMemo(() => {
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const map = names.map((name) => ({ name, timeMs: 0, correct: 0, total: 0 }));

    for (const r of studyRecords || []) {
      if (!r.date) continue;
      const d = new Date(r.date + (r.date.includes('T') ? '' : 'T12:00:00'));
      const dayIdx = d.getDay();
      if (dayIdx >= 0 && dayIdx <= 6) {
        map[dayIdx].timeMs += r.studyTime || 0;
        map[dayIdx].correct += r.questions?.correct || 0;
        map[dayIdx].total += r.questions?.total || 0;
      }
    }

    let bestHourDay = map[0];
    let bestAccDay: { name: string; acc: number; total: number } | null = null;

    for (const item of map) {
      if (item.timeMs > bestHourDay.timeMs) bestHourDay = item;
      if (item.total >= 10) {
        const acc = Math.round((item.correct / item.total) * 100);
        if (!bestAccDay || acc > bestAccDay.acc) {
          bestAccDay = { name: item.name, acc, total: item.total };
        }
      }
    }

    return { map, bestHourDay, bestAccDay };
  }, [studyRecords]);

  const sortedSubjectHours = React.useMemo(() => {
    const entries = Object.entries(stats.subjectStudyHours ?? {});
    if (subjectSortOrder === 'desc') {
      entries.sort(([, a], [, b]) => b - a);
    } else if (subjectSortOrder === 'asc') {
      entries.sort(([, a], [, b]) => a - b);
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }
    return entries;
  }, [stats.subjectStudyHours, subjectSortOrder]);

  const formatTime = (milliseconds: number) => {
    if (isNaN(milliseconds) || milliseconds <= 0) {
      return '0h00min';
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h${String(minutes).padStart(2, '0')}min`;
  };

  const handleSaveStudy = (record: StudyRecord) => {
    if (record.id) {
      updateStudyRecord(record);
    } else {
      addStudyRecord({ ...record, id: Date.now().toString() });
    }
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const getPerformanceBadge = (p: number) => {
    if (p >= 75) return 'bg-emerald-500/15 text-emerald-500';
    if (p >= 50) return 'bg-amber-500/15 text-amber-400';
    return 'bg-rose-500/15 text-rose-400';
  };

  const HierarchicalPerformanceRow: React.FC<{
    node: HierarchicalPerformanceNode;
    level: number;
  }> = ({ node, level }) => {
    const [isExpanded, setIsExpanded] = React.useState(allTopicsExpanded);
    const hasChildren = !!(node.children && node.children.length > 0);

    React.useEffect(() => {
      setIsExpanded(allTopicsExpanded);
    }, [allTopicsExpanded]);

    const indentation = level * 20;

    return (
      <>
        <tr className="border-b border-slate-100 dark:border-[#1f304a] hover:bg-slate-50/70 dark:hover:bg-[#17263f]/50 transition-colors text-xs">
          <td
            style={{ paddingLeft: `${indentation + 20}px` }}
            className="py-3 px-4 text-slate-800 dark:text-slate-100"
          >
            <div className="flex items-center gap-2">
              {hasChildren ? (
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
              <span className={hasChildren ? 'font-bold' : 'font-medium'}>{node.name}</span>
            </div>
          </td>
          <td className="py-3 px-4 text-center font-bold text-emerald-500">{node.acertos}</td>
          <td className="py-3 px-4 text-center font-bold text-rose-400">{node.erros}</td>
          <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
            {node.total}
          </td>
          <td className="py-3 px-6 text-right">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getPerformanceBadge(
                Math.round(node.percentualAcerto)
              )}`}
            >
              {node.percentualAcerto.toFixed(1)}%
            </span>
          </td>
        </tr>
        {hasChildren &&
          isExpanded &&
          node.children.map((child, index) => (
            <HierarchicalPerformanceRow
              key={child.id || index}
              node={child}
              level={level + 1}
            />
          ))}
      </>
    );
  };

  const sortedDates = Object.keys(stats.dailyQuestionStats ?? {}).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const lineData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Acertos Diários',
        data: sortedDates.map((d) => (stats.dailyQuestionStats ?? {})[d].correct),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
      },
      {
        label: 'Erros Diários',
        data: sortedDates.map((d) => (stats.dailyQuestionStats ?? {})[d].incorrect),
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        tension: 0.3,
      },
    ],
  };

  const sortedHourDates = Object.keys(stats.dailyStudyHours ?? {}).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Estatísticas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Análise completa de horas líquidas, constância, leitura e taxa de acerto
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors"
          >
            <Filter className="w-4 h-4 text-emerald-500" />
            Filtros
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar Estudo
          </button>
        </div>
      </div>

      {/* Top Row: Doughnut + 5 KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* General Performance Doughnut */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Desempenho Geral
            </span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <ChartComponents stats={stats} />
          <div className="flex items-center justify-around text-xs pt-2 border-t border-slate-100 dark:border-[#1f304a]">
            <div>
              <span className="text-slate-400">Acertos: </span>
              <strong className="text-emerald-500">{stats.totalCorrectQuestions}</strong>
            </div>
            <div>
              <span className="text-slate-400">Erros: </span>
              <strong className="text-rose-400">
                {Math.max(0, stats.totalQuestions - stats.totalCorrectQuestions)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400">Total: </span>
              <strong className="text-slate-800 dark:text-white">{stats.totalQuestions}</strong>
            </div>
          </div>
        </div>

        {/* 5 KPI Cards Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Tempo Total
              </span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatTime(stats.totalStudyTime)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Média de {formatTime(stats.totalStudyTime / (stats.uniqueStudyDays || 1))}/dia
              </p>
            </div>
            <div className="text-[11px] text-emerald-500 font-semibold">
              {stats.uniqueStudyDays} dias estudados
            </div>
          </div>

          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Constância
              </span>
              <Flame className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-emerald-500">
                {stats.studyConsistencyPercentage.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {stats.uniqueStudyDays} de {stats.totalDaysSinceFirstRecord} dias ativos
              </p>
            </div>
            <div className="text-[11px] text-slate-400">
              {stats.failedStudyDays} dias sem registro
            </div>
          </div>

          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Avanço no Edital
              </span>
              <ListChecks className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {stats.overallEditalProgress.toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {stats.completedTopics} de {stats.totalTopics} tópicos
              </p>
            </div>
            <div className="text-[11px] text-slate-400">
              {stats.pendingTopics} tópicos pendentes
            </div>
          </div>

          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Páginas Lidas
              </span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalPagesRead}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ritmo: {stats.pagesPerHour.toFixed(1)} págs/hora
              </p>
            </div>
            <div className="text-[11px] text-slate-400">Leitura de PDFs / Livros</div>
          </div>

          <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex flex-col justify-between sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Tempo em Videoaulas
              </span>
              <Video className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="my-2">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatTime(stats.totalVideoTime)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Total acumulado em aulas assistidas
              </p>
            </div>
            <div className="text-[11px] text-slate-400">Contabilizado nos registros</div>
          </div>
        </div>
      </div>

      {/* Charts Row: Daily Questions & Daily Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Evolução de Questões (Acertos x Erros)
          </h2>
          <div className="h-64">
            {sortedDates.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum registro de questões ainda.
              </div>
            ) : (
              <Line
                data={lineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: {
                      beginAtZero: true,
                      ticks: { color: '#94a3b8' },
                      grid: { color: 'rgba(148, 163, 184, 0.12)' },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Horas de Estudo por Dia
          </h2>
          <div className="h-64">
            {sortedHourDates.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum registro de horas ainda.
              </div>
            ) : (
              <Bar
                data={{
                  labels: sortedHourDates.map((date) => {
                    const [y, m, d] = date.split('-');
                    return `${d}/${m}`;
                  }),
                  datasets: [
                    {
                      label: 'Horas',
                      data: sortedHourDates.map((d) => (stats.dailyStudyHours ?? {})[d]),
                      backgroundColor: '#10b981',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: {
                      beginAtZero: true,
                      ticks: { color: '#94a3b8' },
                      grid: { color: 'rgba(148, 163, 184, 0.12)' },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Disciplines x Hours + Categories Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Disciplinas x Horas de Estudo
            </h2>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#0b1320] p-1 gap-1">
              <button
                onClick={() => setSubjectSortOrder('desc')}
                className={`p-1.5 rounded-lg text-xs ${
                  subjectSortOrder === 'desc'
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400'
                }`}
                title="Maior tempo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSubjectSortOrder('asc')}
                className={`p-1.5 rounded-lg text-xs ${
                  subjectSortOrder === 'asc'
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400'
                }`}
                title="Menor tempo"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSubjectSortOrder('alpha')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                  subjectSortOrder === 'alpha'
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400'
                }`}
              >
                A-Z
              </button>
            </div>
          </div>

          <div className="h-72">
            {sortedSubjectHours.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem horas por disciplina registradas.
              </div>
            ) : (
              <Bar
                data={{
                  labels: sortedSubjectHours.map(([subject]) => subject),
                  datasets: [
                    {
                      label: 'Horas',
                      data: sortedSubjectHours.map(([, hours]) => hours),
                      backgroundColor: '#6366f1',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { color: '#94a3b8' },
                      grid: { color: 'rgba(148, 163, 184, 0.12)' },
                    },
                    y: {
                      ticks: { color: '#94a3b8', font: { size: 11 } },
                      grid: { display: false },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
            Distribuição por Categoria
          </h2>
          <CategoryHoursChart categoryStudyHours={stats.categoryStudyHours} />
        </div>
      </div>

      {/* INTELIGÊNCIA DE PROVA & DIAGNÓSTICO AVANÇADO (4 Pilares de Alto Rendimento) */}
      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Inteligência de Prova & Diagnóstico Avançado
          </h2>
        </div>

        {/* 1. Termômetro de Projeção Matemática de Fechamento do Edital + 4. Melhor Dia da Semana */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Termômetro de Fechamento do Edital
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Projeção Matemática de Conclusão até a Prova
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Data da Prova:
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => handleExamDateChange(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/60 dark:border-[#1f304a]">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Ritmo Real Atual
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {editalProjection.topicsPerWeek} tópicos/sem
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ~{editalProjection.avgMinutesPerTopic} min investidos por tópico
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/60 dark:border-[#1f304a]">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Previsão de Fechamento
                </span>
                <div className="text-xl font-extrabold text-indigo-400 mt-1">
                  {editalProjection.pending === 0
                    ? '100% Concluído!'
                    : editalProjection.predictedFinishDate
                    ? editalProjection.predictedFinishDate.toLocaleDateString('pt-BR')
                    : 'Sem ritmo base'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Restam {editalProjection.pending} de {editalProjection.total} tópicos
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/60 dark:border-[#1f304a]">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Meta até a Prova
                </span>
                {editalProjection.daysUntilExam !== null ? (
                  <>
                    <div
                      className={`text-xl font-extrabold mt-1 ${
                        editalProjection.onTrack ? 'text-emerald-500' : 'text-amber-400'
                      }`}
                    >
                      {editalProjection.requiredTopicsPerWeek} tóp/sem
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Faltam {editalProjection.daysUntilExam} dias (~
                      {editalProjection.requiredMinutesPerDay} min/dia p/ fechar)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-slate-500 mt-1">
                      Defina a data da prova acima
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Calculamos a meta diária exata para bater 100%
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Bio-Ritmo Semanal
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                Seus Melhores Dias de Rendimento
              </h3>
            </div>

            <div className="space-y-3 my-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-500">
                    Maior Volume de Horas
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {weekdayPerformance.bestHourDay.timeMs > 0
                      ? weekdayPerformance.bestHourDay.name
                      : 'Sem dados'}
                  </div>
                </div>
                <span className="text-xs font-extrabold text-emerald-500">
                  {formatTime(weekdayPerformance.bestHourDay.timeMs)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-400">
                    Maior Precisão em Questões
                  </span>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {weekdayPerformance.bestAccDay
                      ? weekdayPerformance.bestAccDay.name
                      : 'Mín. 10 questões/dia'}
                  </div>
                </div>
                {weekdayPerformance.bestAccDay && (
                  <span className="text-xs font-extrabold text-indigo-400">
                    {weekdayPerformance.bestAccDay.acc}% acerto
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Use seus dias de pico de precisão para matérias de alta complexidade ou baterias difíceis.
            </p>
          </div>
        </div>

        {/* 2. Raio-X de Pontos Cegos de Alto Risco + 3. Diagnóstico de Motivos de Erro */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Raio-X de Pontos Cegos */}
          <div className="lg:col-span-7 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Matriz Relevância × Score
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[11px] font-bold">
                  {blindSpots.length} alertas
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Raio-X de Pontos Cegos de Alto Risco
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">
                Tópicos de alta importância para a prova que estão com Score baixo (&lt; 70), poucas questões (&lt; 15) ou ainda não estudados.
              </p>

              {blindSpots.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#0b1320] text-xs text-slate-400">
                  Excelente! Nenhum ponto cego crítico de alta relevância detectado no momento.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {blindSpots.map((bs, idx) => (
                    <div
                      key={`${bs.subject}-${bs.topic}-${idx}`}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200/70 dark:border-[#1f304a] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-400 truncate">
                            {bs.subject}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-bold">
                            Importância {bs.relevance}/5
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                          {bs.topic}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {bs.studied
                            ? `Score: ${bs.currentScore} pts • ${bs.totalQuestions} questões • ROI: ${bs.priorityROI}`
                            : `Ainda não estudado • ${bs.totalQuestions} questões • ROI: ${bs.priorityROI}`}
                        </div>
                      </div>
                      <Link
                        href={`/materias/${encodeURIComponent(bs.subject)}`}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-500 hover:text-white text-xs font-bold transition-colors"
                      >
                        Atacar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Diagnóstico de Motivos de Erro */}
          <div className="lg:col-span-5 bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Raio-X de Erros em Questões
                </span>
                <select
                  value={selectedErrorSubject}
                  onChange={(e) => setSelectedErrorSubject(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Todas as Disciplinas</option>
                  {errorDiagnosis.subjectsList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Por que você está errando questões?
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">
                Distribuição das tags rápidas marcadas ao registrar baterias com erros.
              </p>

              {errorDiagnosis.breakdown.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#0b1320] text-xs text-slate-400">
                  Nenhuma tag de motivo de erro registrada ainda. Ao lançar questões erradas, clique nos motivos (ex: Letra de Lei, Pegadinha, Falta de Base) para gerar seu diagnóstico!
                </div>
              ) : (
                <div className="space-y-3">
                  {errorDiagnosis.breakdown.map((item) => (
                    <div key={item.reason} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {item.reason}
                        </span>
                        <span className="font-extrabold text-rose-400">
                          {item.pct}% ({item.count}x)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500"
                          style={{ width: `${Math.max(6, item.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorDiagnosis.breakdown.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1f304a] text-[11px] text-slate-400">
                💡 <strong>Recomendação:</strong> Maior incidência em{' '}
                <strong className="text-rose-400">{errorDiagnosis.breakdown[0].reason}</strong>.
                Priorize revisões focadas nessa lacuna antes do próximo simulado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hierarchical Topic Performance Table */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#1f304a] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Desempenho Detalhado por Disciplina e Tópico
          </h2>
          <button
            onClick={() => setAllTopicsExpanded((prev) => !prev)}
            className="text-xs font-semibold text-emerald-500 hover:text-emerald-400"
          >
            {allTopicsExpanded ? 'Recolher Todos' : 'Expandir Todos'}
          </button>
        </div>

        {!stats.topicPerformance || stats.topicPerformance.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Nenhum registro de desempenho por tópico disponível.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-6">Disciplina / Tópico</th>
                  <th className="py-3 px-4 text-center">Acertos</th>
                  <th className="py-3 px-4 text-center">Erros</th>
                  <th className="py-3 px-4 text-center">Total</th>
                  <th className="py-3 px-6 text-right">Desempenho</th>
                </tr>
              </thead>
              <tbody>
                {stats.topicPerformance.map((subjectNode, index) => (
                  <HierarchicalPerformanceRow
                    key={subjectNode.id || index}
                    node={subjectNode}
                    level={0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudyRegisterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStudy}
        initialRecord={editingRecord}
        showDeleteButton={!!editingRecord?.id}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={(filters) => {
          applyFilters(filters);
          setIsFilterModalOpen(false);
        }}
        sessions={stats.allRecords || []}
        availableSubjects={availableSubjects}
        availableEditalData={stats.editalData}
        availableCategories={availableCategories}
      />
    </div>
  );
}
