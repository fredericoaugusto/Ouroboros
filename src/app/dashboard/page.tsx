'use client';

import React, { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useData } from '../../context/DataContext';
import StudyRegisterModal, { StudyRecord } from '../../components/StudyRegisterModal';
import WeeklyStudyChart from '../../components/WeeklyStudyChart';
import RevisionsSection from '../../components/RevisionsSection';
import PlanningSection from '../../components/PlanningSection';
import DailyStudySection from '../../components/DailyStudySection';
import RemindersSection from '../../components/RemindersSection';
import LastActivitiesSection from '../../components/LastActivitiesSection';
import ImportEditalModal from '../../components/ImportEditalModal';
import {
  Clock,
  Target,
  ClipboardCheck,
  Quote,
  Flame,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Sparkles,
  BookOpen,
} from 'lucide-react';

const formatHoursMinutes = (ms: number) => {
  if (isNaN(ms) || ms <= 0) return '0h00min';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
};

const StudyConsistencyTracker = ({
  consecutiveDays,
  daysData = [],
  startDate,
  endDate,
  onPrev,
  onNext,
  isPrevDisabled,
  isNextDisabled,
}: any) => {
  const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const getTooltipText = (day: any) => {
    const [y, m, d] = (day.date || '').split('-').map(Number);
    const date = y ? new Date(y, m - 1, d) : new Date(day.date);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const mins = day.minutesStudied || 0;
    let statusText = 'Não estudado (mín. 30min)';
    if (day.status === 'studied') statusText = `Estudado (${mins}min)`;
    else if (day.status === 'partial') statusText = `Em andamento: ${mins}min / 30min mínimos`;
    else if (day.status === 'pending_today') statusText = 'Hoje (mín. 30min para validar)';
    else if (day.status === 'rest') statusText = 'Dia de folga';
    else if (day.status === 'failed' && mins > 0) statusText = `Incompleto (${mins}min / 30min)`;
    return `${formattedDate}: ${statusText}`;
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Constância nos Estudos
            </h2>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#0c1421] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1f304a]">
              mín. 30min/dia
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
            <Flame size={15} className="text-amber-500 fill-amber-500" />
            <strong className="text-emerald-500 font-bold">
              {consecutiveDays || 0} {consecutiveDays === 1 ? 'dia seguido.' : 'dias seguidos.'}
            </strong>{' '}
            Continue firme na rotina!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={isPrevDisabled}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1f304a] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a293e] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-[90px] text-center">
            {formatDate(startDate)} – {formatDate(endDate)}
          </span>
          <button
            onClick={onNext}
            disabled={isNextDisabled}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1f304a] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a293e] disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-10 sm:grid-cols-15 gap-2">
        {daysData.map((day: any, index: number) => {
          const isStudied = day.status === 'studied';
          const isPartial = day.status === 'partial';
          const isFailed = day.active && day.status === 'failed';
          return (
            <div key={index} className="relative group flex justify-center">
              <div
                className={`w-full h-8 rounded-lg flex items-center justify-center border transition-all ${
                  isStudied
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500 shadow-sm shadow-emerald-500/5'
                    : isPartial
                    ? 'bg-emerald-500/5 border-emerald-500/30 border-dashed text-emerald-500/70'
                    : isFailed
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                    : 'bg-slate-100 dark:bg-[#0c1421] border-slate-200 dark:border-[#1a293e] text-slate-400'
                }`}
              >
                {isStudied && <Check size={14} strokeWidth={3} />}
                {isPartial && <span className="text-[9px] font-bold">{day.minutesStudied}m</span>}
              </div>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2.5 py-1 bg-slate-900 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                {getTooltipText(day)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeeklyStudyGoals = ({ currentHours, goalHours, currentQuestions, goalQuestions }: any) => {
  const hoursPercentage = goalHours > 0 ? Math.min((currentHours / goalHours) * 100, 100) : 0;
  const questionsPercentage = goalQuestions > 0 ? Math.min((currentQuestions / goalQuestions) * 100, 100) : 0;

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Metas Semanais
        </h2>
      </div>

      <div className="space-y-4">
        {/* Horas de Estudo */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Horas de Estudo
              </span>
              <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                {formatHoursMinutes(currentHours)}{' '}
                <span className="text-slate-400 font-normal">
                  / {goalHours > 0 ? formatHoursMinutes(goalHours) : '0h00min'} planejadas
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {hoursPercentage.toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-400 block">da meta</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#0c1421] rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${hoursPercentage}%` }}
            />
          </div>
        </div>

        {/* Questões Resolvidas */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Questões Resolvidas
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {currentQuestions || 0}{' '}
                <span className="text-slate-400 font-normal">
                  / {goalQuestions > 0 ? goalQuestions : 0} esperadas
                </span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {questionsPercentage.toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-400 block">da meta</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#0c1421] rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${questionsPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const {
    addStudyRecord,
    stats,
    handleConsistencyNav,
    studyHours,
    weeklyQuestionsGoal,
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    setInitialStudyRecord,
  } = useData();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleSave = (record: StudyRecord) => {
    addStudyRecord(record);
    setIsRegisterModalOpen(false);
  };

  const overallPerformance = useMemo(() => {
    return stats.totalQuestions > 0 ? (stats.totalCorrectQuestions / stats.totalQuestions) * 100 : 0;
  }, [stats.totalCorrectQuestions, stats.totalQuestions]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const userName = session?.user?.name || 'Estudante';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {userName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cada dia conta na construção da sua aprovação.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#131f33] hover:bg-slate-200 dark:hover:bg-[#1a293e] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#1f304a] text-xs font-bold transition-all"
          >
            <Sparkles size={14} className="text-emerald-500" />
            Importar Edital IA
          </button>
          <button
            onClick={() => {
              setInitialStudyRecord(null);
              setIsRegisterModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus size={15} strokeWidth={2.5} />
            Adicionar Estudo
          </button>
        </div>
      </header>

      {/* Top 4 KPI Cards (Estilo Estudei 2.0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tempo de Estudo */}
        <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tempo de Estudo
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatHoursMinutes(stats.totalStudyTime)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Média diária:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {formatHoursMinutes(stats.totalStudyTime / (stats.uniqueStudyDays || 1))}
              </strong>
            </p>
          </div>
        </div>

        {/* Card 2: Desempenho */}
        <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Desempenho
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Target size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overallPerformance.toFixed(0)}%
              </p>
              <span className="text-xs text-slate-400">({stats.totalQuestions || 0} questões)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Acertos: <strong className="text-emerald-500">{stats.totalCorrectQuestions || 0}</strong> • Erros:{' '}
              <strong className="text-rose-500">
                {(stats.totalQuestions || 0) - (stats.totalCorrectQuestions || 0)}
              </strong>
            </p>
          </div>
        </div>

        {/* Card 3: Progresso no Edital */}
        <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Progresso no Edital
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ClipboardCheck size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {stats.overallEditalProgress.toFixed(0)}%
              </p>
              <span className="text-xs text-slate-400">
                ({stats.completedTopics || 0} de {stats.totalTopics || 0} tópicos)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Em <strong className="text-slate-700 dark:text-slate-200">{stats.editalData?.length || 0}</strong>{' '}
              disciplinas cadastradas
            </p>
          </div>
        </div>

        {/* Card 4: Motivação */}
        <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <Quote size={32} className="text-slate-200 dark:text-[#1f304a] absolute top-3 left-3 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-center h-full text-center px-2">
            <p className="text-xs italic text-slate-600 dark:text-slate-300 leading-relaxed">
              “A disciplina é a ponte entre metas e realizações.”
              <span className="block not-italic font-bold text-slate-400 mt-1">— Jim Rohn</span>
            </p>
          </div>
        </div>
      </div>

      {/* Rastreador de Constância */}
      <StudyConsistencyTracker
        consecutiveDays={stats.consecutiveDays}
        daysData={stats.consistencyData}
        startDate={stats.consistencyStartDate}
        endDate={stats.consistencyEndDate}
        onPrev={() => handleConsistencyNav(1)}
        onNext={() => handleConsistencyNav(-1)}
        isPrevDisabled={stats.isConsistencyPrevDisabled}
        isNextDisabled={stats.isConsistencyNextDisabled}
      />

      {/* Grid Principal: Esquerda (Planejamento + Revisões + Desempenho) e Direita (Metas + Gráficos + Lembretes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <PlanningSection />
          <RevisionsSection />

          {/* Painel de Desempenho por Disciplina */}
          <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} className="text-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Desempenho por Disciplina
              </h2>
            </div>

            {Object.keys(stats.subjectPerformance || {}).length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma disciplina estudada ainda neste plano.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#1a293e] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 pr-4">Disciplina</th>
                      <th className="py-2.5 px-3 text-center">Tempo</th>
                      <th className="py-2.5 px-3 text-center">Questões</th>
                      <th className="py-2.5 pl-3 text-right">Acerto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1a293e] text-xs">
                    {Object.entries(stats.subjectPerformance).map(([subjectName, subjectStats]: any, index) => {
                      const perf = subjectStats.performance || 0;
                      const badgeColor =
                        perf >= 75
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : perf >= 50
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

                      return (
                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-[#182740]/50 transition-colors">
                          <td className="py-3 pr-4 font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            {subjectName}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                            {formatHoursMinutes(subjectStats.totalStudyTime)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-emerald-500 font-bold">{subjectStats.correctQuestions}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-500">
                              {subjectStats.correctQuestions + subjectStats.incorrectQuestions}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                              {perf.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <LastActivitiesSection />
        </div>

        {/* Coluna Direita (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <WeeklyStudyGoals
            currentHours={stats.weeklyHours}
            goalHours={parseInt(studyHours || '20', 10) * 60 * 60 * 1000}
            currentQuestions={stats.weeklyQuestions}
            goalQuestions={parseInt(weeklyQuestionsGoal || '150', 10)}
          />
          <WeeklyStudyChart
            dailyStudyHours={stats.dailyStudyHours}
            dailyQuestionStats={stats.dailyQuestionStats}
          />
          <DailyStudySection
            dailySubjectStudyTime={stats.dailySubjectStudyTime}
            subjectColors={stats.editalData}
          />
          <RemindersSection />
        </div>
      </div>

      {/* Modal de Importação via IA */}
      <ImportEditalModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
