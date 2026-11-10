'use client';

import React from 'react';
import { useData, HierarchicalPerformanceNode, StudyRecord } from '../../context/DataContext';
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
