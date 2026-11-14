'use client';

import React, { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useData } from '../../context/DataContext';
import { createPlanFile, importSubjectsBagagemFromPlanAction } from '../actions';
import Link from 'next/link';
import CreatePlanModal from '../../components/CreatePlanModal';
import ImportEditalModal from '../../components/ImportEditalModal';
import {
  Plus,
  FolderKanban,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  HelpCircle,
  Award,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import ConfirmationModal from '../../components/ConfirmationModal';
import ImportGuideForm from '../../components/ImportGuideForm';

interface PlanContent {
  name: string;
  observations: string;
  cargo?: string;
  edital?: string;
  iconUrl?: string;
  subjects: Subject[];
  banca?: string;
}

interface Subject {
  subject: string;
  topics: Topic[];
}

interface Topic {
  topic_number?: string;
  topic_text: string;
  is_completed?: boolean;
  status?: string;
  sub_topics?: Topic[];
}

interface PlanInfo {
  fileName: string;
  name: string;
  cargo?: string;
  edital?: string;
  iconUrl?: string;
  subjectCount: number;
  topicCount: number;
  completedTopics: number;
  banca?: string;
}

export default function Planos() {
  const { status } = useSession();
  const {
    deletePlan,
    availablePlans,
    studyPlans,
    selectedDataFile,
    setSelectedDataFile,
    studyRecords,
    loading: dataContextLoading,
    refreshPlans,
  } = useData();
  const { showNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportAIModalOpen, setIsImportAIModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanInfo | null>(null);

  // Reaproveitamento de Bagagem entre Planos
  const [isBagagemModalOpen, setIsBagagemModalOpen] = useState(false);
  const [sourceBagagemPlan, setSourceBagagemPlan] = useState<string>('');
  const [selectedBagagemSubjects, setSelectedBagagemSubjects] = useState<string[]>([]);
  const [copyBagagemHistory, setCopyBagagemHistory] = useState<boolean>(true);
  const [isImportingBagagem, setIsImportingBagagem] = useState<boolean>(false);

  const sourcePlanSubjects = useMemo(() => {
    if (!sourceBagagemPlan || !availablePlans || !studyPlans) return [];
    const idx = availablePlans.indexOf(sourceBagagemPlan);
    if (idx === -1) return [];
    const raw = studyPlans[idx] as any;
    const subjectsList: Subject[] = Array.isArray(raw) ? raw : raw?.subjects || [];
    return subjectsList.map((s) => s.subject).filter(Boolean);
  }, [sourceBagagemPlan, availablePlans, studyPlans]);

  const handleImportBagagem = async () => {
    if (!sourceBagagemPlan || !selectedDataFile || selectedBagagemSubjects.length === 0) {
      showNotification('Selecione o plano de origem e ao menos uma disciplina.', 'warning');
      return;
    }
    setIsImportingBagagem(true);
    try {
      const res = await importSubjectsBagagemFromPlanAction({
        sourceFileName: sourceBagagemPlan,
        targetFileName: selectedDataFile,
        subjectNames: selectedBagagemSubjects,
        copyStudyHistory: copyBagagemHistory,
      });
      if (res.success) {
        await refreshPlans(true);
        showNotification(
          `Bagagem importada! ${res.importedSubjectsCount} disciplina(s) e ${res.copiedRecordsCount || 0} registro(s) trazidos para o plano ativo.`,
          'success'
        );
        setIsBagagemModalOpen(false);
        setSelectedBagagemSubjects([]);
      } else {
        showNotification(res.error || 'Erro ao importar bagagem.', 'error');
      }
    } finally {
      setIsImportingBagagem(false);
    }
  };

  const handleDeleteClick = (event: React.MouseEvent, plan: PlanInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setPlanToDelete(plan);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (planToDelete) {
      await deletePlan(planToDelete.fileName);
      showNotification(`Plano "${planToDelete.name}" excluído com sucesso.`, 'success');
      setPlanToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const handleSavePlan = async (planData: {
    name: string;
    observations: string;
    cargo: string;
    edital: string;
    banca?: string;
    image?: File;
    imageFile?: File;
  }) => {
    const formData = new FormData();
    formData.append('name', planData.name);
    formData.append('observations', planData.observations);
    formData.append('cargo', planData.cargo);
    formData.append('edital', planData.edital);
    if (planData.banca) formData.append('banca', planData.banca);
    const img = planData.imageFile || planData.image;
    if (img) {
      formData.append('image', img);
    }

    const result = await createPlanFile(formData);

    if (result.success) {
      showNotification(`Plano "${planData.name}" criado com sucesso!`, 'success');
      setIsModalOpen(false);
      await refreshPlans();
      if (result.fileName) {
        setSelectedDataFile(result.fileName);
      }
    } else {
      showNotification(`Erro: ${result.error}`, 'error');
    }
  };

  const plansToDisplay: PlanInfo[] = useMemo(() => {
    if (!availablePlans || !studyPlans) return [];

    const countTopicsRecursively = (topics: Topic[]): { total: number; completed: number } => {
      let total = 0;
      let completed = 0;
      if (!topics) return { total: 0, completed: 0 };
      for (const topic of topics) {
        total++;
        if (topic.is_completed || topic.status === 'studied') {
          completed++;
        }
        if (topic.sub_topics && topic.sub_topics.length > 0) {
          const sub = countTopicsRecursively(topic.sub_topics);
          total += sub.total;
          completed += sub.completed;
        }
      }
      return { total, completed };
    };

    return availablePlans.map((fileName, index) => {
      const rawData = studyPlans[index];
      let plan: PlanContent;

      if (Array.isArray(rawData)) {
        plan = {
          name: fileName
            .replace('.json', '')
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          observations: '',
          subjects: rawData,
          banca: '',
        };
      } else if (rawData && typeof rawData === 'object') {
        plan = rawData as PlanContent;
      } else {
        plan = {
          name: fileName
            .replace('.json', '')
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          observations: '',
          subjects: [],
          banca: '',
        };
      }

      const uniqueSubjectsMap = new Map<string, Subject>();
      (plan.subjects || []).forEach((s) => uniqueSubjectsMap.set(s.subject, s));
      const subjectsToCount = Array.from(uniqueSubjectsMap.values());

      let totalTopics = 0;
      let completedTopics = 0;
      subjectsToCount.forEach((subject) => {
        const res = countTopicsRecursively(subject.topics || []);
        totalTopics += res.total;
        completedTopics += res.completed;
      });

      return {
        fileName,
        name: plan.name || fileName.replace('.json', '').toUpperCase(),
        cargo: plan.cargo,
        edital: plan.edital,
        iconUrl: plan.iconUrl,
        subjectCount: subjectsToCount.length,
        topicCount: totalTopics,
        completedTopics,
        banca: plan.banca,
      };
    });
  }, [availablePlans, studyPlans]);

  // Stats for active plan
  const activePlanStats = useMemo(() => {
    const totalMs = studyRecords.reduce((acc, r) => acc + (r.studyTime || 0), 0);
    const totalHours = Math.floor(totalMs / 3600000);
    const totalMins = Math.floor((totalMs % 3600000) / 60000);
    const correct = studyRecords.reduce((acc, r) => acc + (r.correctQuestions || 0), 0);
    const incorrect = studyRecords.reduce((acc, r) => acc + (r.incorrectQuestions || 0), 0);
    const totalQ = correct + incorrect;
    const accPct = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    const studiedTopicSet = new Set(studyRecords.map((r) => r.topic).filter(Boolean));
    return {
      timeFormatted: `${totalHours}h${String(totalMins).padStart(2, '0')}min`,
      totalQ,
      accPct,
      studiedTopicsCount: studiedTopicSet.size,
    };
  }, [studyRecords]);

  if (status === 'loading' || (status === 'authenticated' && dataContextLoading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Planos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie seus objetivos, editais verticalizados e progresso global
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {plansToDisplay.length > 1 && (
            <button
              onClick={() => {
                const otherPlan = plansToDisplay.find((p) => p.fileName !== selectedDataFile);
                if (otherPlan) {
                  setSourceBagagemPlan(otherPlan.fileName);
                }
                setSelectedBagagemSubjects([]);
                setIsBagagemModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-all"
              title="Traga disciplinas, resumos, links de cadernos, pesos e histórico de estudo de outro plano"
            >
              <Layers className="w-4 h-4" />
              Reaproveitar Bagagem de Outro Plano
            </button>
          )}

          <button
            onClick={() => setIsImportAIModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Importar Edital via IA
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Criar Plano
          </button>
        </div>
      </div>

      {/* Plans List (Estudei 2.0 Horizontal Card Style) */}
      {plansToDisplay.length === 0 ? (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-4">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Você ainda não possui nenhum plano de estudos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Crie um plano do zero ou importe seu edital completo estruturado via Inteligência Artificial em poucos segundos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setIsImportAIModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Importar Edital via IA
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-[#1a2b47] text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-[#223759] transition-all"
            >
              <Plus className="w-4 h-4" />
              Criar Plano Manualmente
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {plansToDisplay.map((plan) => {
            const isSelected = selectedDataFile === plan.fileName;
            const completedCount = isSelected
              ? Math.max(plan.completedTopics, activePlanStats.studiedTopicsCount)
              : plan.completedTopics;
            const progressPct =
              plan.topicCount > 0
                ? Math.min(100, Math.round((completedCount / plan.topicCount) * 100))
                : 0;

            return (
              <div
                key={plan.fileName}
                className={`group relative bg-white dark:bg-[#131f33] rounded-2xl border transition-all p-5 sm:p-6 ${
                  isSelected
                    ? 'border-emerald-500/50 dark:border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'border-slate-200/80 dark:border-[#1f304a] hover:border-slate-300 dark:hover:border-[#2c4266]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: Plan Identity */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] flex items-center justify-center overflow-hidden shrink-0">
                      {plan.iconUrl ? (
                        <img
                          src={plan.iconUrl}
                          alt={plan.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderKanban className="w-7 h-7 text-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          href={`/planos/${plan.fileName}`}
                          className="text-lg font-bold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors truncate"
                        >
                          {plan.name}
                        </Link>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativo
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedDataFile(plan.fileName);
                              showNotification(`Plano "${plan.name}" ativado!`, 'success');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white transition-colors"
                          >
                            Tornar Ativo
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {plan.cargo && <span>Cargo: <strong className="text-slate-700 dark:text-slate-200">{plan.cargo}</strong></span>}
                        {plan.banca && <span>Banca: <strong className="text-slate-700 dark:text-slate-200">{plan.banca}</strong></span>}
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          {plan.subjectCount} disciplinas • {plan.topicCount} tópicos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center/Right: Metrics & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:gap-8 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-[#1f304a]">
                    {/* Progress Bar */}
                    <div className="min-w-[200px]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold uppercase tracking-wider text-slate-400 text-[10px]">
                          Avanço no Edital
                        </span>
                        <span className="font-bold text-emerald-500">{progressPct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {completedCount} de {plan.topicCount} tópicos concluídos
                      </p>
                    </div>

                    {/* Stats if Active */}
                    {isSelected && (
                      <div className="grid grid-cols-3 gap-5 border-l border-slate-100 dark:border-[#1f304a] pl-5">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Horas de Estudo
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-500" />
                            {activePlanStats.timeFormatted}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Questões
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                            {activePlanStats.totalQ}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Desempenho
                          </div>
                          <div className="text-sm font-bold text-emerald-500 mt-0.5 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5" />
                            {activePlanStats.accPct}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Link
                        href={`/planos/${plan.fileName}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 transition-colors"
                      >
                        Gerenciar
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={(e) => handleDeleteClick(e, plan)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Excluir Plano"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TEC Guide Importer */}
      <ImportGuideForm />

      <CreatePlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlan}
      />

      <ImportEditalModal
        isOpen={isImportAIModalOpen}
        onClose={() => setIsImportAIModalOpen(false)}
      />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o plano "${planToDelete?.name}"? Esta ação é irreversível.`}
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      {/* Modal de Reaproveitamento de Bagagem entre Planos */}
      {isBagagemModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsBagagemModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 block">
                  Reaproveitamento Inteligente de Bagagem
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Importar Disciplinas, Notas e Histórico de Outro Plano
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Traga suas anotações, links de cadernos, pesos (I/D/M) e histórico de questões para o plano ativo sem começar do zero.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
                  1. Copiar bagagem de qual plano?
                </label>
                <select
                  value={sourceBagagemPlan}
                  onChange={(e) => {
                    setSourceBagagemPlan(e.target.value);
                    setSelectedBagagemSubjects([]);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-white"
                >
                  <option value="">Selecione um plano de origem...</option>
                  {plansToDisplay
                    .filter((p) => p.fileName !== selectedDataFile)
                    .map((p) => (
                      <option key={p.fileName} value={p.fileName}>
                        {p.name} ({p.subjectCount} disciplinas)
                      </option>
                    ))}
                </select>
              </div>

              {sourceBagagemPlan && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      2. Selecione as disciplinas que deseja reaproveitar ({selectedBagagemSubjects.length}/{sourcePlanSubjects.length})
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedBagagemSubjects(
                          selectedBagagemSubjects.length === sourcePlanSubjects.length
                            ? []
                            : [...sourcePlanSubjects]
                        )
                      }
                      className="text-[11px] font-bold text-indigo-500 hover:underline"
                    >
                      {selectedBagagemSubjects.length === sourcePlanSubjects.length
                        ? 'Desmarcar todas'
                        : 'Selecionar todas'}
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50 dark:bg-[#0b1320] p-2.5 space-y-1.5">
                    {sourcePlanSubjects.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">
                        Este plano não possui disciplinas cadastradas.
                      </p>
                    ) : (
                      sourcePlanSubjects.map((subj) => {
                        const checked = selectedBagagemSubjects.includes(subj);
                        return (
                          <label
                            key={subj}
                            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-indigo-500/15 text-indigo-500 font-bold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-[#131f33]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedBagagemSubjects((prev) =>
                                  checked ? prev.filter((s) => s !== subj) : [...prev, subj]
                                )
                              }
                              className="rounded accent-indigo-500"
                            />
                            <span className="truncate">{subj}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyBagagemHistory}
                  onChange={(e) => setCopyBagagemHistory(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <div className="text-xs">
                  <strong className="text-slate-900 dark:text-white block">
                    Copiar também o histórico de questões e estudos dessas disciplinas
                  </strong>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Assim o Krono Score Engine v3.1 já mantém sua estabilidade de memória e taxa de acerto acumulada.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBagagemModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isImportingBagagem || selectedBagagemSubjects.length === 0}
                onClick={handleImportBagagem}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 shadow-sm transition-all"
              >
                {isImportingBagagem ? 'Importando Bagagem...' : 'Importar Bagagem p/ Plano Ativo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
