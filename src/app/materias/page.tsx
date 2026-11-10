'use client';

import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import {
  BookOpen,
  Search,
  Plus,
  Clock,
  HelpCircle,
  Award,
  History,
  Edit3,
  Trash2,
  FolderKanban,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddSubjectModal, { Topic } from '../../components/AddSubjectModal';
import ImportEditalModal from '../../components/ImportEditalModal';
import { getJsonContent, updatePlanFile } from '../actions';
import { useNotification } from '../../context/NotificationContext';

const formatTime = (milliseconds: number) => {
  if (isNaN(milliseconds) || milliseconds <= 0) {
    return '0h00min';
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, '0')}min`;
};

const countTopicsRecursively = (topics: Topic[]): { total: number; completed: number } => {
  let total = 0;
  let completed = 0;
  if (!topics) return { total: 0, completed: 0 };
  for (const t of topics) {
    total++;
    if (t.is_completed || t.status === 'studied') completed++;
    if (t.sub_topics && t.sub_topics.length > 0) {
      const sub = countTopicsRecursively(t.sub_topics);
      total += sub.total;
      completed += sub.completed;
    }
  }
  return { total, completed };
};

export default function MateriasPage() {
  const {
    studyPlans,
    availablePlans,
    selectedDataFile,
    studyRecords,
    loading,
    refreshPlans,
  } = useData();
  const router = useRouter();
  const { showNotification } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<{
    subject: string;
    topics: Topic[];
    color: string;
  } | null>(null);

  const activePlanIndex = useMemo(() => {
    if (!selectedDataFile || !availablePlans) return 0;
    const idx = availablePlans.indexOf(selectedDataFile);
    return idx >= 0 ? idx : 0;
  }, [selectedDataFile, availablePlans]);

  const activePlan = useMemo(() => {
    if (!studyPlans || studyPlans.length === 0) return null;
    const raw = studyPlans[activePlanIndex];
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return {
        name: (selectedDataFile || 'Plano')
          .replace('.json', '')
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        subjects: raw,
      };
    }
    return raw;
  }, [studyPlans, activePlanIndex, selectedDataFile]);

  const subjectsList = useMemo(() => {
    if (!activePlan || !activePlan.subjects) return [];
    const studiedTopicSet = new Set(studyRecords.map((r) => r.topic).filter(Boolean));

    return activePlan.subjects.map((subj: any) => {
      const records = studyRecords.filter((r) => r.subject === subj.subject);
      const totalStudyTime = records.reduce((acc, r) => acc + (r.studyTime || 0), 0);
      const correct = records.reduce(
        (acc, r) => acc + (r.questions?.correct ?? (r as any).correctQuestions ?? 0),
        0
      );
      const totalQ = records.reduce((acc, r) => {
        const qTotal = r.questions?.total;
        if (typeof qTotal === 'number') return acc + qTotal;
        return acc + ((r as any).correctQuestions || 0) + ((r as any).incorrectQuestions || 0);
      }, 0);
      const performance = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;

      const { total: totalTopics, completed: markedCompleted } = countTopicsRecursively(
        subj.topics || []
      );
      // Also count topics that have study records
      const countWithRecords = (topics: Topic[]): number => {
        let c = 0;
        for (const t of topics || []) {
          if (t.is_completed || t.status === 'studied' || studiedTopicSet.has(t.topic_text)) {
            c++;
          }
          if (t.sub_topics?.length) c += countWithRecords(t.sub_topics);
        }
        return c;
      };
      const completedTopics = Math.max(markedCompleted, countWithRecords(subj.topics || []));
      const progressPct =
        totalTopics > 0 ? Math.min(100, Math.round((completedTopics / totalTopics) * 100)) : 0;

      return {
        subject: subj.subject,
        color: subj.color || '#10b981',
        topics: subj.topics || [],
        totalTopics,
        completedTopics,
        progressPct,
        totalStudyTime,
        correct,
        totalQ,
        performance,
      };
    });
  }, [activePlan, studyRecords]);

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjectsList;
    const q = searchQuery.toLowerCase();
    return subjectsList.filter((s: any) => s.subject.toLowerCase().includes(q));
  }, [subjectsList, searchQuery]);

  const overallStats = useMemo(() => {
    const totalStudyTime = subjectsList.reduce((acc: number, s: any) => acc + s.totalStudyTime, 0);
    const totalQ = subjectsList.reduce((acc: number, s: any) => acc + s.totalQ, 0);
    const totalCorrect = subjectsList.reduce((acc: number, s: any) => acc + s.correct, 0);
    const overallPerformance = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
    const totalTopics = subjectsList.reduce((acc: number, s: any) => acc + s.totalTopics, 0);
    const completedTopics = subjectsList.reduce(
      (acc: number, s: any) => acc + s.completedTopics,
      0
    );
    const progressPct =
      totalTopics > 0 ? Math.min(100, Math.round((completedTopics / totalTopics) * 100)) : 0;

    return {
      totalStudyTime,
      totalQ,
      overallPerformance,
      totalTopics,
      completedTopics,
      progressPct,
    };
  }, [subjectsList]);

  const handleSaveSubject = async (subjectName: string, topics: Topic[], color: string) => {
    if (!selectedDataFile) {
      showNotification('Selecione ou crie um plano primeiro.', 'error');
      return;
    }

    const rawPlan = await getJsonContent(selectedDataFile);
    const planObj =
      rawPlan && !Array.isArray(rawPlan)
        ? rawPlan
        : {
            name: selectedDataFile.replace('.json', ''),
            observations: '',
            subjects: Array.isArray(rawPlan) ? rawPlan : [],
          };

    let updatedSubjects = Array.isArray(planObj.subjects) ? [...planObj.subjects] : [];

    if (subjectToEdit) {
      updatedSubjects = updatedSubjects.map((s: any) =>
        s.subject === subjectToEdit.subject ? { ...s, subject: subjectName, topics, color } : s
      );
    } else {
      updatedSubjects.push({ subject: subjectName, topics, color });
    }

    const res = await updatePlanFile(selectedDataFile, {
      ...planObj,
      subjects: updatedSubjects,
    });

    if (res.success) {
      showNotification(
        subjectToEdit
          ? 'Disciplina atualizada com sucesso!'
          : 'Disciplina adicionada com sucesso!',
        'success'
      );
      setSubjectToEdit(null);
      await refreshPlans();
    } else {
      showNotification(`Erro ao salvar disciplina: ${res.error}`, 'error');
    }
  };

  const handleDeleteSubject = async (subjectName: string) => {
    if (!selectedDataFile) return;
    if (!window.confirm(`Deseja realmente excluir a disciplina "${subjectName}"?`)) return;

    const rawPlan = await getJsonContent(selectedDataFile);
    if (!rawPlan) return;
    const planObj = Array.isArray(rawPlan)
      ? { name: selectedDataFile.replace('.json', ''), subjects: rawPlan }
      : rawPlan;

    const updatedSubjects = (planObj.subjects || []).filter(
      (s: any) => s.subject !== subjectName
    );
    const res = await updatePlanFile(selectedDataFile, {
      ...planObj,
      subjects: updatedSubjects,
    });

    if (res.success) {
      showNotification(`Disciplina "${subjectName}" excluída.`, 'success');
      await refreshPlans();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!selectedDataFile || !activePlan) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Nenhum Plano Ativo Selecionado
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Importe um edital via IA ou crie um plano de estudos para visualizar e gerenciar suas disciplinas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Importar Edital via IA
            </button>
            <Link
              href="/planos"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-all"
            >
              Ir para Planos
            </Link>
          </div>
        </div>
        <ImportEditalModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Disciplinas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Acompanhe o progresso, desempenho e histórico de cada matéria do seu plano ativo
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSubjectToEdit(null);
              setIsSubjectModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Disciplina
          </button>
        </div>
      </div>

      {/* Active Plan Banner (Estudei Print 2 style) */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activePlan.name || selectedDataFile.replace('.json', '')}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subjectsList.length} disciplinas • {overallStats.totalTopics} tópicos
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8">
            <div className="min-w-[200px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Avanço no Edital
                </span>
                <span className="font-bold text-emerald-500">{overallStats.progressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${overallStats.progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {overallStats.completedTopics} de {overallStats.totalTopics} tópicos concluídos
              </p>
            </div>

            <div className="grid grid-cols-3 gap-6 border-l border-slate-100 dark:border-[#1f304a] pl-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Horas de Estudo
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatTime(overallStats.totalStudyTime)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Questões
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {overallStats.totalQ}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Desempenho
                </div>
                <div className="text-sm font-bold text-emerald-500 mt-0.5">
                  {overallStats.overallPerformance}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table Card */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] shadow-sm overflow-hidden">
        {/* Search Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200/80 dark:border-[#1f304a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar disciplina..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-400">
            Exibindo <strong>{filteredSubjects.length}</strong> de {subjectsList.length} disciplinas
          </span>
        </div>

        {/* Disciplines Table */}
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Nenhuma disciplina encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Disciplina</th>
                  <th className="py-3.5 px-4">Progresso no Edital</th>
                  <th className="py-3.5 px-4">Tempo de Estudo</th>
                  <th className="py-3.5 px-4">Questões</th>
                  <th className="py-3.5 px-4">Desempenho</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1f304a]">
                {filteredSubjects.map((subj: any) => (
                  <tr
                    key={subj.subject}
                    className="group hover:bg-slate-50/80 dark:hover:bg-[#17263f]/60 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: subj.color }}
                        />
                        <div>
                          <button
                            onClick={() =>
                              router.push(
                                `/materias/${encodeURIComponent(subj.subject)}?plan=${selectedDataFile}`
                              )
                            }
                            className="text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors text-left"
                          >
                            {subj.subject}
                          </button>
                          <div className="text-[11px] text-slate-400">
                            {subj.totalTopics} tópicos
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 min-w-[180px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {subj.completedTopics}/{subj.totalTopics}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                          {subj.progressPct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${subj.progressPct}%`,
                            backgroundColor: subj.color || '#10b981',
                          }}
                        />
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatTime(subj.totalStudyTime)}
                    </td>

                    <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="font-bold text-emerald-500">{subj.correct}</span> /{' '}
                      <span>{subj.totalQ}</span>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          subj.totalQ === 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : subj.performance >= 75
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : subj.performance >= 50
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {subj.performance}%
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() =>
                            router.push(
                              `/materias/${encodeURIComponent(subj.subject)}?plan=${selectedDataFile}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          title="Histórico e Edital Verticalizado da Disciplina"
                        >
                          <History className="w-3.5 h-3.5" />
                          Histórico / Edital
                        </button>
                        <button
                          onClick={() => {
                            setSubjectToEdit(subj);
                            setIsSubjectModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          title="Editar Disciplina"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(subj.subject)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Excluir Disciplina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddSubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => {
          setIsSubjectModalOpen(false);
          setSubjectToEdit(null);
        }}
        onSave={handleSaveSubject}
        initialSubjectData={subjectToEdit}
      />
    </div>
  );
}
