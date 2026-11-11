'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useData, StudyRecord } from '../../context/DataContext';
import { findTopicNotebookUrl } from '../../lib/scoreEngine';
import {
  FiPlus,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiCheckCircle,
  FiCalendar,
  FiSearch,
  FiX,
  FiBookOpen,
  FiExternalLink,
} from 'react-icons/fi';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import FilterModal from '../../components/FilterModal';
import ConfirmationModal from '../../components/ConfirmationModal';

const formatTime = (ms: number) => {
  const totalMinutes = Math.round((ms || 0) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}min`;
};

const categoryDisplayMap: { [key: string]: { label: string; badgeClass: string } } = {
  teoria: {
    label: 'Teoria',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  revisao: {
    label: 'Revisão',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  questoes: {
    label: 'Questões',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  leitura_lei: {
    label: 'Leitura de Lei',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  jurisprudencia: {
    label: 'Jurisprudência',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
};

export interface Filters {
  subject: string;
  category: string;
  startDate: string;
  endDate: string;
}

const HistoricoPage = () => {
  const {
    studyRecords,
    addStudyRecord,
    updateStudyRecord,
    deleteStudyRecord,
    studyPlans,
    availablePlans,
    selectedDataFile,
    stats,
  } = useData();
  const currentPlanSubjects = useMemo(() => {
    const idx = availablePlans.indexOf(selectedDataFile);
    const currentPlan = idx >= 0 && studyPlans[idx] ? studyPlans[idx] : studyPlans[0];
    return Array.isArray(currentPlan) ? currentPlan : currentPlan?.subjects || [];
  }, [availablePlans, selectedDataFile, studyPlans]);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StudyRecord | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [filters, setFilters] = useState<Filters>({
    subject: '',
    category: '',
    startDate: '',
    endDate: '',
  });

  const subjectColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    if (studyPlans) {
      studyPlans.forEach(plan => {
        plan.subjects?.forEach(subject => {
          if (!colorMap.has(subject.subject)) {
            colorMap.set(subject.subject, subject.color || '#10b981');
          }
        });
      });
    }
    return colorMap;
  }, [studyPlans]);

  const filteredRecords = useMemo(() => {
    return studyRecords.filter(record => {
      const recordDate = new Date(record.date);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;

      if (startDate && recordDate < startDate) return false;
      if (endDate && recordDate > endDate) return false;
      if (filters.subject && record.subject !== filters.subject) return false;
      if (filters.category && record.category !== filters.category) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSubject = record.subject?.toLowerCase().includes(q);
        const matchTopic = record.topic?.toLowerCase().includes(q);
        const matchComments = record.comments?.toLowerCase().includes(q);
        if (!matchSubject && !matchTopic && !matchComments) return false;
      }

      return true;
    });
  }, [studyRecords, filters, searchTerm]);

  const summaryKpis = useMemo(() => {
    let totalMs = 0;
    let totalQ = 0;
    let totalC = 0;
    filteredRecords.forEach(r => {
      totalMs += r.studyTime || 0;
      totalQ += r.questions?.total || 0;
      totalC += r.questions?.correct || 0;
    });
    const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
    return {
      count: filteredRecords.length,
      totalMs,
      totalQ,
      totalC,
      acc,
    };
  }, [filteredRecords]);

  const groupedRecords = useMemo(() => {
    return filteredRecords.reduce((acc, record) => {
      const date = new Date(record.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(record);
      return acc;
    }, {} as Record<string, StudyRecord[]>);
  }, [filteredRecords]);

  const sortedDates = useMemo(
    () =>
      Object.keys(groupedRecords).sort(
        (a, b) =>
          new Date(b.split('/').reverse().join('-')).getTime() -
          new Date(a.split('/').reverse().join('-')).getTime()
      ),
    [groupedRecords]
  );

  const handleAddClick = () => {
    setEditingRecord(null);
    setIsRegisterModalOpen(true);
  };

  const handleEditClick = (record: StudyRecord) => {
    setEditingRecord(record);
    setIsRegisterModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (recordToDelete) {
      deleteStudyRecord(recordToDelete);
      setRecordToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const handleSave = (record: StudyRecord) => {
    if (editingRecord) {
      updateStudyRecord(record);
    } else {
      addStudyRecord(record);
    }
    setIsRegisterModalOpen(false);
  };

  const handleApplyFilters = (newFilters: any) => {
    if (newFilters && typeof newFilters === 'object') {
      setFilters({
        subject: newFilters.subject || (newFilters.subjects?.[0] ?? ''),
        category: newFilters.category || (newFilters.categories?.[0] ?? ''),
        startDate:
          newFilters.startDate instanceof Date
            ? newFilters.startDate.toISOString().split('T')[0]
            : newFilters.startDate || '',
        endDate:
          newFilters.endDate instanceof Date
            ? newFilters.endDate.toISOString().split('T')[0]
            : newFilters.endDate || '',
      });
    }
    setIsFilterModalOpen(false);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || searchTerm.trim() !== '';

  const clearAllFilters = () => {
    setFilters({ subject: '', category: '', startDate: '', endDate: '' });
    setSearchTerm('');
  };

  const availableSubjects = useMemo(() => {
    if (stats && stats.editalData) {
      return stats.editalData.map(s => s.subject);
    }
    return [];
  }, [stats]);

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Histórico de Estudos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Registro cronológico completo de todas as suas sessões de estudo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs border transition-all ${
                Object.values(filters).some(v => v !== '')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#192841]'
              }`}
            >
              <FiFilter className="w-3.5 h-3.5" />
              Filtros
            </button>
            <button
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-sm transition-all"
            >
              <FiPlus className="w-4 h-4 stroke-[2.5]" />
              Registrar Estudo
            </button>
          </div>
        </header>

        {/* KPI Summary Strip + Search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-8 grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-[#131f33] rounded-2xl p-4 border border-slate-200 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Sessões Filtradas
              </span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                {summaryKpis.count}
              </span>
            </div>
            <div className="bg-white dark:bg-[#131f33] rounded-2xl p-4 border border-slate-200 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Tempo Acumulado
              </span>
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatTime(summaryKpis.totalMs)}
              </span>
            </div>
            <div className="bg-white dark:bg-[#131f33] rounded-2xl p-4 border border-slate-200 dark:border-[#1f304a] shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Desempenho
              </span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
                {summaryKpis.acc}%{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({summaryKpis.totalC}/{summaryKpis.totalQ})
                </span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-4 flex items-center gap-2">
            <div className="relative flex-1">
              <FiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar matéria, tópico ou nota..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-3 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-3 rounded-2xl bg-slate-100 dark:bg-[#1a2942] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Main Records List */}
        {sortedDates.length === 0 ? (
          <div className="bg-white dark:bg-[#131f33] rounded-2xl p-12 border border-slate-200 dark:border-[#1f304a] text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <FiBookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              {hasActiveFilters
                ? 'Nenhum registro corresponde aos filtros'
                : 'Nenhum estudo registrado ainda'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              {hasActiveFilters
                ? 'Tente limpar os filtros para visualizar todo o seu histórico.'
                : 'Inicie o cronômetro ou adicione seu primeiro estudo manualmente.'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1a2942] text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Limpar Filtros
              </button>
            ) : (
              <button
                onClick={handleAddClick}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
              >
                + Registrar Primeiro Estudo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => {
              const dayRecords = groupedRecords[date];
              const dayMs = dayRecords.reduce((acc, r) => acc + (r.studyTime || 0), 0);

              return (
                <section
                  key={date}
                  className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-[#0f1929]/60 border-b border-slate-100 dark:border-[#1f304a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiCalendar className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-sm font-bold text-slate-800 dark:text-white">{date}</h2>
                      <span className="text-[11px] font-medium text-slate-400">
                        • {dayRecords.length} {dayRecords.length === 1 ? 'sessão' : 'sessões'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <FiClock className="w-3.5 h-3.5" />
                      {formatTime(dayMs)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-[#1f304a]/60">
                    {dayRecords.map((record, index) => {
                      const catInfo = categoryDisplayMap[record.category] || {
                        label: record.category || 'Estudo',
                        badgeClass:
                          'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
                      };
                      const qTotal = record.questions?.total || 0;
                      const qCorrect = record.questions?.correct || 0;
                      const qPct = qTotal > 0 ? Math.round((qCorrect / qTotal) * 100) : null;
                      const notebookUrl = findTopicNotebookUrl(
                        currentPlanSubjects,
                        record.subject,
                        record.topic
                      );

                      return (
                        <div
                          key={`${record.id}-${index}`}
                          className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-[#17263f]/50 transition-colors"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <span
                              className="w-1.5 h-10 rounded-full shrink-0 mt-0.5"
                              style={{
                                backgroundColor:
                                  subjectColorMap.get(record.subject) || '#10b981',
                              }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/materias/${encodeURIComponent(record.subject)}`}
                                  className="text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors truncate"
                                  title="Ir para a disciplina"
                                >
                                  {record.subject}
                                </Link>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${catInfo.badgeClass}`}
                                >
                                  {catInfo.label}
                                </span>
                                {notebookUrl && (
                                  <a
                                    href={notebookUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition-colors"
                                    title="Abrir Caderno de Questões"
                                  >
                                    <FiExternalLink className="w-2.5 h-2.5" />
                                    Caderno
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                {record.topic || 'Tópico geral'}
                              </p>
                              {record.comments && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic line-clamp-1">
                                  “{record.comments}”
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-5 sm:pl-0">
                            <div className="flex items-center gap-4 text-xs">
                              <div className="text-right">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                                  Duração
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {formatTime(record.studyTime)}
                                </span>
                              </div>

                              {qTotal > 0 && (
                                <div className="text-right">
                                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                                    Questões
                                  </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    <span className="text-emerald-500">{qCorrect}</span>/{qTotal}{' '}
                                    <span className="text-[11px] text-slate-400">({qPct}%)</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEditClick(record)}
                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-[#1f304a] transition-colors"
                                title="Editar registro"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(record.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Excluir registro"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <StudyRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSave={handleSave}
        initialRecord={editingRecord}
        showDeleteButton={!!editingRecord?.id}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilters}
        onApplyFilters={handleApplyFilters}
        availableSubjects={availableSubjects}
        availableCategories={Object.keys(categoryDisplayMap)}
        initialFilters={filters}
        sessions={studyRecords as any}
        availableEditalData={stats?.editalData || []}
      />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este registro de estudo? Esta ação não poderá ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default HistoricoPage;
