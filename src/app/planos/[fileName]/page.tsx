'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  getJsonContent,
  updatePlanFile,
  getStudyRecords,
  StudyRecord,
  deletePlanFile,
  uploadImage,
} from '../../actions';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AddSubjectModal from '../../../components/AddSubjectModal';
import CreatePlanModal from '../../../components/CreatePlanModal';
import Breadcrumbs from '../../../components/Breadcrumbs';
import {
  Plus,
  Edit3,
  Trash2,
  FolderKanban,
  Eye,
  ArrowLeft,
  Clock,
  HelpCircle,
  Award,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { useData } from '../../../context/DataContext';
import ConfirmationModal from '../../../components/ConfirmationModal';

interface PlanData {
  name: string;
  observations: string;
  cargo?: string;
  edital?: string;
  banca?: string;
  iconUrl?: string;
  subjects: Subject[];
  bancaTopicWeights?: {
    [subjectName: string]: {
      [topicText: string]: number;
    };
  };
}

interface Subject {
  subject: string;
  topics: Topic[];
  color: string;
}

interface Topic {
  topic_number?: string;
  topic_text: string;
  sub_topics?: Topic[];
}

const formatTime = (milliseconds: number) => {
  if (isNaN(milliseconds) || milliseconds < 0) {
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
    if (studiedTopicTexts.has(topic.topic_text)) {
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
    const uniqueSubjectsMap = new Map<string, Subject>();
    subjectsWithColors.forEach((s) => uniqueSubjectsMap.set(s.subject, s));
    return {
      name: fileName
        .replace('.json', '')
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      observations: '',
      cargo: '',
      edital: '',
      iconUrl: undefined,
      subjects: Array.from(uniqueSubjectsMap.values()),
    };
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const subjectsWithColors = subjects.map((subject: Subject) => ({
      ...subject,
      color: subject.color || defaultColor,
    }));
    const uniqueSubjectsMap = new Map<string, Subject>();
    subjectsWithColors.forEach((s) => uniqueSubjectsMap.set(s.subject, s));
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
      cargo: (data as any).cargo || '',
      edital: (data as any).edital || '',
      banca: (data as any).banca || '',
      subjects: Array.from(uniqueSubjectsMap.values()),
    };
  }

  return {
    name: fileName
      .replace('.json', '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    observations: '',
    cargo: '',
    edital: '',
    iconUrl: undefined,
    subjects: [],
  };
};

export default function PlanoDetalhes() {
  const params = useParams();
  const fileName = params.fileName as string;
  const router = useRouter();
  const { showNotification } = useNotification();
  const { selectedDataFile, setSelectedDataFile, refreshPlans } = useData();

  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [studyRecords, setStudyRecords] = useState<StudyRecord[]>([]);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<PlanData | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanData | null>(null);

  const handleEditPlan = () => {
    setPlanToEdit(planData);
    setIsEditPlanModalOpen(true);
  };

  const planStats = React.useMemo(() => {
    if (!planData || !studyRecords) {
      return { totalStudyTime: 0, totalQuestions: 0, overallPerformance: 0 };
    }
    const planSubjectNames = new Set(planData.subjects.map((s) => s.subject));
    const filteredRecords = studyRecords.filter((record) =>
      planSubjectNames.has(record.subject)
    );
    const totalStudyTime = filteredRecords.reduce(
      (acc, record) => acc + (record.studyTime || 0),
      0
    );
    const totalCorrectQuestions = filteredRecords.reduce(
      (acc, record) => acc + (record.correctQuestions || 0),
      0
    );
    const totalIncorrectQuestions = filteredRecords.reduce(
      (acc, record) => acc + (record.incorrectQuestions || 0),
      0
    );
    const totalQuestions = totalCorrectQuestions + totalIncorrectQuestions;
    const overallPerformance =
      totalQuestions > 0 ? Math.round((totalCorrectQuestions / totalQuestions) * 100) : 0;

    return { totalStudyTime, totalQuestions, overallPerformance };
  }, [planData, studyRecords]);

  const calculateSubjectStats = useCallback((plan: PlanData | null, records: StudyRecord[]) => {
    const stats: {
      [key: string]: {
        studiedTopics: number;
        totalTopics: number;
        totalQuestions: number;
        correctQuestions: number;
        studyTime: number;
      };
    } = {};

    if (!plan) return stats;

    plan.subjects.forEach((subject) => {
      const totalTopics = countTopicsRecursively(subject.topics || []);
      const subjRecords = records.filter((record) => record.subject === subject.subject);
      const studiedTopicTexts = new Set(subjRecords.map((record) => record.topic));
      const studiedTopics = countStudiedTopicsRecursively(
        subject.topics || [],
        studiedTopicTexts
      );
      let totalQuestions = 0;
      let correctQuestions = 0;
      let studyTime = 0;

      subjRecords.forEach((record) => {
        const c = record.correctQuestions || 0;
        const inc = record.incorrectQuestions || 0;
        correctQuestions += c;
        totalQuestions += c + inc;
        studyTime += record.studyTime || 0;
      });

      stats[subject.subject] = {
        studiedTopics,
        totalTopics,
        totalQuestions,
        correctQuestions,
        studyTime,
      };
    });
    return stats;
  }, []);

  const subjectStats = React.useMemo(() => {
    return calculateSubjectStats(planData, studyRecords);
  }, [planData, studyRecords, calculateSubjectStats]);

  const fetchPlanData = useCallback(async () => {
    setLoading(true);
    if (fileName) {
      const data = await getJsonContent(fileName);
      const records = await getStudyRecords(fileName);
      if (data) {
        const normalizedData = normalizePlanData(data, fileName);
        setPlanData(normalizedData);
        setStudyRecords(records);
      }
    }
    setLoading(false);
  }, [fileName]);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  const handleSaveSubject = async (subjectName: string, topics: Topic[], color: string) => {
    if (!planData) return;

    let updatedSubjects: Subject[];
    let successMessage: string;

    if (subjectToEdit) {
      updatedSubjects = planData.subjects.map((s) =>
        s.subject === subjectToEdit.subject
          ? { ...s, subject: subjectName, topics, color }
          : s
      );
      successMessage = 'Disciplina atualizada com sucesso!';
    } else {
      const newSubject: Subject = {
        subject: subjectName,
        topics,
        color,
      };
      updatedSubjects = [...planData.subjects, newSubject];
      successMessage = 'Disciplina adicionada com sucesso!';
    }

    const updatedPlanData = {
      ...planData,
      subjects: updatedSubjects,
    };

    setPlanData(updatedPlanData);
    setIsSubjectModalOpen(false);
    setSubjectToEdit(null);

    const result = await updatePlanFile(fileName, updatedPlanData);
    if (result.success) {
      showNotification(successMessage, 'success');
      await refreshPlans();
    } else {
      showNotification(`Erro ao salvar a disciplina: ${result.error}`, 'error');
    }
  };

  const handleSaveEditedPlan = async (updatedFields: {
    name: string;
    observations: string;
    cargo: string;
    edital: string;
    banca?: string;
    imageFile?: File;
    existingIconUrl?: string;
  }) => {
    if (!planData) return;

    let finalIconUrl = updatedFields.existingIconUrl;

    if (updatedFields.imageFile) {
      const formData = new FormData();
      formData.append('imageFile', updatedFields.imageFile);
      formData.append('baseName', updatedFields.name);

      const uploadResult = await uploadImage(formData);
      if (uploadResult.success && uploadResult.iconUrl) {
        finalIconUrl = uploadResult.iconUrl;
      } else {
        showNotification(`Erro ao fazer upload da nova imagem: ${uploadResult.error}`, 'error');
        return;
      }
    }

    const updatedPlanContent = {
      ...planData,
      name: updatedFields.name,
      observations: updatedFields.observations,
      cargo: updatedFields.cargo,
      edital: updatedFields.edital,
      banca: updatedFields.banca,
      iconUrl: finalIconUrl,
    };

    const result = await updatePlanFile(fileName, updatedPlanContent);
    if (result.success) {
      showNotification('Plano atualizado com sucesso!', 'success');
      setIsEditPlanModalOpen(false);
      fetchPlanData();
      await refreshPlans();
    } else {
      showNotification(`Erro ao atualizar o plano: ${result.error}`, 'error');
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setSubjectToEdit(subject);
    setIsSubjectModalOpen(true);
  };

  const handleDeleteSubject = async (subjectToDelete: Subject) => {
    if (!planData) return;

    const confirmDelete = confirm(
      `Tem certeza que deseja excluir a disciplina "${subjectToDelete.subject}"?`
    );

    if (confirmDelete) {
      const updatedSubjects = planData.subjects.filter(
        (s) => s.subject !== subjectToDelete.subject
      );
      const updatedPlanData = { ...planData, subjects: updatedSubjects };
      setPlanData(updatedPlanData);

      const result = await updatePlanFile(fileName, updatedPlanData);
      if (result.success) {
        showNotification('Disciplina excluída com sucesso!', 'success');
        await refreshPlans();
      } else {
        showNotification(`Erro ao excluir a disciplina: ${result.error}`, 'error');
      }
    }
  };

  const handleDeletePlan = () => {
    setPlanToDelete(planData);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (planToDelete) {
      const result = await deletePlanFile(fileName);
      if (result.success) {
        showNotification('Plano excluído com sucesso!', 'success');
        await refreshPlans();
        router.push('/planos');
      } else {
        showNotification(`Erro ao excluir o plano: ${result.error}`, 'error');
      }
      setIsConfirmModalOpen(false);
      setPlanToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        Plano não encontrado.
      </div>
    );
  }

  const totalPlanTopics = planData.subjects.reduce(
    (acc, s) => acc + countTopicsRecursively(s.topics || []),
    0
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb navigation */}
      <Breadcrumbs
        items={[
          { label: 'Planos', href: '/planos' },
          { label: planData.name },
        ]}
        className="mb-1"
      />

      {/* Plan Hero Card */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] flex items-center justify-center overflow-hidden shrink-0">
              {planData.iconUrl ? (
                <img
                  src={planData.iconUrl}
                  alt={planData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FolderKanban className="w-9 h-9 text-emerald-500" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {planData.name}
                </h1>
                {selectedDataFile === fileName ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Plano Ativo
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedDataFile(fileName);
                      showNotification(`Plano "${planData.name}" ativado!`, 'success');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                  >
                    Ativar este Plano
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {planData.cargo && (
                  <span>
                    Cargo: <strong className="text-slate-700 dark:text-slate-200">{planData.cargo}</strong>
                  </span>
                )}
                {planData.banca && (
                  <span>
                    Banca: <strong className="text-slate-700 dark:text-slate-200">{planData.banca}</strong>
                  </span>
                )}
                {planData.edital && (
                  <span>
                    Edital: <strong className="text-slate-700 dark:text-slate-200">{planData.edital}</strong>
                  </span>
                )}
                <span>
                  <strong className="text-slate-700 dark:text-slate-200">{planData.subjects.length}</strong> disciplinas •{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{totalPlanTopics}</strong> tópicos
                </span>
              </div>

              {planData.observations && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
                  {planData.observations}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
            <button
              onClick={() => {
                setIsSubjectModalOpen(true);
                setSubjectToEdit(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova Disciplina
            </button>
            <button
              onClick={handleEditPlan}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
              title="Editar Plano"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeletePlan}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#1a2942] text-slate-600 dark:text-slate-300 hover:text-rose-500 transition-colors"
              title="Excluir Plano"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-[#1f304a]">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320]/60 border border-slate-200/60 dark:border-[#1f304a]">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Horas Estudadas
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                {formatTime(planStats.totalStudyTime)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320]/60 border border-slate-200/60 dark:border-[#1f304a]">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Questões Resolvidas
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                {planStats.totalQuestions}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320]/60 border border-slate-200/60 dark:border-[#1f304a]">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Desempenho Geral
              </div>
              <div className="text-lg font-extrabold text-emerald-500">
                {planStats.overallPerformance}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subjects List */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-[#1f304a] flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            Disciplinas do Plano ({planData.subjects.length})
          </h2>
        </div>

        {planData.subjects.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Nenhuma disciplina cadastrada neste plano ainda. Clique em "Nova Disciplina" para adicionar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1f304a]">
            {planData.subjects.map((subject, idx) => {
              const stats = subjectStats[subject.subject] || {
                studiedTopics: 0,
                totalTopics: 0,
                totalQuestions: 0,
                correctQuestions: 0,
                studyTime: 0,
              };
              const progPct =
                stats.totalTopics > 0
                  ? Math.round((stats.studiedTopics / stats.totalTopics) * 100)
                  : 0;
              const accPct =
                stats.totalQuestions > 0
                  ? Math.round((stats.correctQuestions / stats.totalQuestions) * 100)
                  : 0;

              return (
                <div
                  key={`${subject.subject}-${idx}`}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-[#17263f]/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-3 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: subject.color || '#10b981' }}
                    />
                    <div className="min-w-0">
                      <button
                        onClick={() =>
                          router.push(
                            `/materias/${encodeURIComponent(subject.subject)}?plan=${fileName}`
                          )
                        }
                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors text-left truncate block"
                      >
                        {subject.subject}
                      </button>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {stats.studiedTopics} de {stats.totalTopics} tópicos estudados ({progPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end sm:self-center">
                    <div className="hidden md:block text-right">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Tempo
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {formatTime(stats.studyTime)}
                      </div>
                    </div>

                    <div className="hidden md:block text-right">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Questões
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {stats.correctQuestions}/{stats.totalQuestions} ({accPct}%)
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          router.push(
                            `/materias/${encodeURIComponent(subject.subject)}?plan=${fileName}`
                          )
                        }
                        className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        title="Ver Histórico e Edital da Disciplina"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditSubject(subject)}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        title="Editar Disciplina"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Excluir Disciplina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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

      <CreatePlanModal
        isOpen={isEditPlanModalOpen}
        onClose={() => setIsEditPlanModalOpen(false)}
        onSave={handleSaveEditedPlan}
        initialPlanData={planToEdit}
        isEditing={true}
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
    </div>
  );
}
