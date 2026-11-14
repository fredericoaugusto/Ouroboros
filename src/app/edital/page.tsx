'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  ListChecks,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import {
  useData,
  StudyRecord,
  EditalTopic as Topic,
} from '../../context/DataContext';
import { useNotification } from '../../context/NotificationContext';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import TopicCockpitModal, { TopicMetadata } from '../../components/TopicCockpitModal';
import ImportEditalModal from '../../components/ImportEditalModal';
import TopicRow from '../../components/TopicRow';
import { updateTopicDetailsAction, addSubtopicAction } from '../actions';
import { computeSubjectScore } from '../../lib/scoreEngine';

const SUBJECT_PALETTE = [
  '#10b981',
  '#6366f1',
  '#0ea5e9',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#14b8a6',
  '#f97316',
];

const EditalPage = () => {
  const {
    addStudyRecord,
    updateStudyRecord,
    studyRecords,
    simuladoRecords,
    selectedDataFile,
    stats,
    loading,
    refreshPlans,
  } = useData();

  const { showNotification } = useNotification();
  const [expandedSubjects, setExpandedSubjects] = useState<Record<number, boolean>>({ 0: true });
  const [allTopicsExpanded, setAllTopicsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ subject: string; topic: Topic } | null>(
    null
  );
  const [editingRecord, setEditingRecord] = useState<StudyRecord | null>(null);
  const [cockpitTarget, setCockpitTarget] = useState<{
    subject: string;
    color: string;
    topic: any;
  } | null>(null);

  const toggleSubject = (index: number) => {
    setExpandedSubjects((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const openRegisterModalForTopic = (subject: string, topic: Topic) => {
    setSelectedTopic({ subject, topic });
    setEditingRecord(null);
    setIsRegisterModalOpen(true);
  };

  const openRegisterModalForNew = () => {
    setSelectedTopic(null);
    setEditingRecord(null);
    setIsRegisterModalOpen(true);
  };

  const closeRegisterModal = () => {
    setSelectedTopic(null);
    setEditingRecord(null);
    setIsRegisterModalOpen(false);
  };

  const handleSaveStudy = (record: StudyRecord) => {
    if (editingRecord) {
      updateStudyRecord(record);
    } else {
      addStudyRecord(record);
    }
    closeRegisterModal();
  };

  const handleToggleCompletion = async (subjectText: string, topicText: string) => {
    const subjObj = stats.editalData.find((s) => s.subject === subjectText);
    const subjectId = subjObj?.id || '';

    // Localiza o nó clicado na árvore do edital para saber se está concluído e se possui subtópicos
    const findNode = (list: Topic[]): Topic | null => {
      for (const t of list || []) {
        if (t.topic_text === topicText) return t;
        if (t.sub_topics && t.sub_topics.length > 0) {
          const found = findNode(t.sub_topics);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = subjObj ? findNode(subjObj.topics) : null;
    const isCurrentlyCompleted = Boolean(targetNode?.is_completed);
    const nextCompletedState = !isCurrentlyCompleted;

    // Coleta o próprio tópico e eventuais subtópicos folhas
    const leafTopicNames: string[] = [];
    const allTopicNames: string[] = [];
    const collectTopics = (node: Topic | null) => {
      if (!node) return;
      allTopicNames.push(node.topic_text);
      if (!node.sub_topics || node.sub_topics.length === 0) {
        leafTopicNames.push(node.topic_text);
      } else {
        node.sub_topics.forEach(collectTopics);
      }
    };
    if (targetNode) {
      collectTopics(targetNode);
    } else {
      leafTopicNames.push(topicText);
      allTopicNames.push(topicText);
    }

    // Atualiza todos os registros de estudo correspondentes
    const matchingRecords = studyRecords.filter(
      (record) => record.subject === subjectText && allTopicNames.includes(record.topic)
    );

    if (nextCompletedState) {
      // Marcar como concluído
      for (const leafName of leafTopicNames) {
        const recsForLeaf = studyRecords.filter(
          (r) => r.subject === subjectText && r.topic === leafName
        );
        if (recsForLeaf.length > 0) {
          for (const rec of recsForLeaf) {
            if (!rec.teoriaFinalizada) {
              await updateStudyRecord({ ...rec, teoriaFinalizada: true });
            }
          }
        } else {
          const newRecord: Omit<StudyRecord, 'id'> = {
            date: new Date().toISOString().split('T')[0],
            subjectId,
            subject: subjectText,
            topic: leafName,
            studyTime: 0,
            questions: { correct: 0, total: 0 },
            pages: [],
            videos: [],
            notes: '',
            category: 'teoria',
            teoriaFinalizada: true,
            countInPlanning: false,
          };
          await addStudyRecord(newRecord);
        }
      }
    } else {
      // Desmarcar como concluído
      for (const rec of matchingRecords) {
        if (rec.teoriaFinalizada) {
          await updateStudyRecord({ ...rec, teoriaFinalizada: false });
        }
      }
    }

    // Também sincroniza o status no arquivo JSON do plano caso tenha sido marcado pelo Cockpit
    if (selectedDataFile) {
      for (const tName of allTopicNames) {
        await updateTopicDetailsAction(selectedDataFile, subjectText, tName, {
          is_completed: nextCompletedState,
          status: nextCompletedState ? 'completed' : 'not_started',
        });
      }
      await refreshPlans();
    }
  };

  const handleSaveTopicCockpit = async (updatedTopic: TopicMetadata) => {
    if (!selectedDataFile || !cockpitTarget) return;
    setCockpitTarget((prev) =>
      prev ? { ...prev, topic: { ...prev.topic, ...updatedTopic } } : null
    );
    const res = await updateTopicDetailsAction(
      selectedDataFile,
      cockpitTarget.subject,
      updatedTopic.topic_text,
      updatedTopic
    );
    if (res.success) {
      await refreshPlans();
    } else {
      showNotification(`Erro ao atualizar tópico: ${res.error}`, 'error');
    }
  };

  const handleAddSubtopic = async (subjectText: string, parentTopicText: string) => {
    if (!selectedDataFile) return;
    const newName = window.prompt(
      `Digite o nome do novo subtópico dentro de "${parentTopicText}":`
    );
    if (!newName || !newName.trim()) return;
    const res = await addSubtopicAction(
      selectedDataFile,
      subjectText,
      parentTopicText,
      newName.trim()
    );
    if (res.success) {
      showNotification(`Subtópico "${newName.trim()}" criado com sucesso!`, 'success');
      await refreshPlans();
    } else {
      showNotification(`Erro ao criar subtópico: ${res.error}`, 'error');
    }
  };

  const { editalData, totalTopics, completedTopics, overallEditalProgress } = stats;

  const filteredEditalData = useMemo(() => {
    if (!searchQuery.trim()) return editalData;
    const q = searchQuery.toLowerCase();
    return editalData.filter((subj) => {
      if (subj.subject.toLowerCase().includes(q)) return true;
      const hasMatchingTopic = (topics: Topic[]): boolean =>
        topics.some(
          (t) =>
            t.topic_text.toLowerCase().includes(q) ||
            (t.sub_topics && hasMatchingTopic(t.sub_topics))
        );
      return hasMatchingTopic(subj.topics || []);
    });
  }, [editalData, searchQuery]);

  if (loading && (!editalData || editalData.length === 0)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const countTopicsRecursively = (
    topics: Topic[]
  ): {
    total: number;
    completed: number;
    totalQuestions: number;
    correctQuestions: number;
  } => {
    let total = 0;
    let completed = 0;
    let totalQuestions = 0;
    let correctQuestions = 0;

    for (const topic of topics) {
      if (!topic.sub_topics || topic.sub_topics.length === 0) {
        total++;
        if (topic.is_completed) completed++;
        totalQuestions += (topic.completed || 0) + (topic.reviewed || 0);
        correctQuestions += topic.completed || 0;
      } else {
        const subCounts = countTopicsRecursively(topic.sub_topics);
        total += subCounts.total;
        completed += subCounts.completed;
        totalQuestions += subCounts.totalQuestions;
        correctQuestions += subCounts.correctQuestions;
      }
    }
    return { total, completed, totalQuestions, correctQuestions };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Edital Verticalizado
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Clique em qualquer tópico ou subtópico para abrir o Cockpit com Resumos, Caderno e Score
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Importar Edital via IA
          </button>

          <button
            onClick={openRegisterModalForNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar Estudo
          </button>
        </div>
      </div>

      {/* Global Edital Progress Banner */}
      <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-emerald-500" />
              Progresso Global no Edital
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              <strong className="text-slate-900 dark:text-white">{completedTopics}</strong> de{' '}
              <strong className="text-slate-900 dark:text-white">{totalTopics}</strong> tópicos concluídos
            </p>
          </div>
          <div className="text-3xl font-extrabold text-emerald-500">
            {overallEditalProgress.toFixed(0)}%
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${Math.min(100, overallEditalProgress)}%` }}
          />
        </div>
      </div>

      {/* Filter & Expand Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar disciplina ou tópico..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const allOpen = Object.keys(expandedSubjects).length === filteredEditalData.length;
              if (allOpen) {
                setExpandedSubjects({});
              } else {
                const next: Record<number, boolean> = {};
                filteredEditalData.forEach((_, i) => (next[i] = true));
                setExpandedSubjects(next);
              }
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-300 hover:border-emerald-500/50 transition-colors"
          >
            Expandir / Recolher Disciplinas
          </button>
        </div>
      </div>

      {/* Subjects Accordion */}
      {filteredEditalData.length === 0 ? (
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-12 text-center">
          <BookOpen className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Nenhum tópico encontrado no Edital
          </h3>
          <p className="text-xs text-slate-400 mb-5">
            Importe um edital completo via IA ou adicione disciplinas ao seu plano ativo.
          </p>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white"
          >
            <Sparkles className="w-4 h-4" />
            Importar Edital via IA
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEditalData.map((subject, subjectIndex) => {
            const subjectColor =
              (subject as any).color || SUBJECT_PALETTE[subjectIndex % SUBJECT_PALETTE.length];
            const {
              total: totalSubjectTopics,
              completed: completedSubjectTopics,
              totalQuestions: totalSubjectQuestions,
              correctQuestions: totalSubjectCompleted,
            } = countTopicsRecursively(subject.topics);
            const reviewed = Math.max(0, totalSubjectQuestions - totalSubjectCompleted);
            const subjectCompletionPercentage =
              totalSubjectTopics > 0
                ? Math.round((completedSubjectTopics / totalSubjectTopics) * 100)
                : 0;
            const subjectPerformance =
              totalSubjectQuestions > 0
                ? Math.round((totalSubjectCompleted / totalSubjectQuestions) * 100)
                : 0;
            const subjScoreObj = computeSubjectScore({
              subjectName: subject.subject,
              topics: subject.topics || [],
              studyRecords: studyRecords || [],
              simuladoRecords: simuladoRecords || [],
            });
            const isExpanded = !!expandedSubjects[subjectIndex];

            return (
              <div
                key={subjectIndex}
                className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] overflow-hidden shadow-sm transition-all"
              >
                {/* Subject Header Row */}
                <div
                  onClick={() => toggleSubject(subjectIndex)}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-[#17263f]/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className="w-2.5 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: subjectColor }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {subject.subject}
                        </h2>
                        {subjScoreObj.topicsEvaluated > 0 && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                            Score: {subjScoreObj.subjectScore} pts • Retenção:{' '}
                            {subjScoreObj.subjectRetention}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {completedSubjectTopics} de {totalSubjectTopics} tópicos concluídos (
                        {subjectCompletionPercentage}%)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {/* Questions Pill */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                        {totalSubjectCompleted} C
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold">
                        {reviewed} E
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#0b1320] text-slate-600 dark:text-slate-300 font-bold">
                        {subjectPerformance}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-28 hidden sm:block">
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0b1320] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${subjectCompletionPercentage}%`,
                            backgroundColor: subjectColor,
                          }}
                        />
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-9 text-right">
                      {subjectCompletionPercentage}%
                    </span>

                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0b1320] text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Topic Tree Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-[#1f304a] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-[#0b1320]/60 border-b border-slate-100 dark:border-[#1f304a] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-2.5 px-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAllTopicsExpanded((prev) => !prev);
                              }}
                              className="inline-flex items-center gap-1.5 hover:text-emerald-500 transition-colors"
                            >
                              {allTopicsExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              Tópico / Subtópico
                            </button>
                          </th>
                          <th className="py-2.5 px-3 text-center">Questões (C / E)</th>
                          <th className="py-2.5 px-3 text-center">Acerto %</th>
                          <th className="py-2.5 px-3 text-center">Score Bússola</th>
                          <th className="py-2.5 px-3 text-center">Último Estudo</th>
                          <th className="py-2.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subject.topics.map((topic, topicIndex) => (
                          <TopicRow
                            key={`${topic.topic_text}-${topicIndex}`}
                            topic={topic as any}
                            subjectName={subject.subject}
                            level={0}
                            studyRecords={studyRecords}
                            onToggleCompletion={handleToggleCompletion}
                            onOpenRegisterModal={openRegisterModalForTopic}
                            onOpenCockpit={(subjName, t) =>
                              setCockpitTarget({
                                subject: subjName,
                                color: subjectColor,
                                topic: t,
                              })
                            }
                            onAddSubtopic={handleAddSubtopic}
                            allTopicsExpanded={allTopicsExpanded}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Study Register Modal */}
      <StudyRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={closeRegisterModal}
        onSave={handleSaveStudy}
        initialRecord={editingRecord}
        topic={selectedTopic}
        initialTime={0}
        showDeleteButton={!!editingRecord?.id}
      />

      {/* AI Edital Importer Modal */}
      <ImportEditalModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Topic Cockpit Full-Page Workspace */}
      {cockpitTarget && (
        <TopicCockpitModal
          isOpen={!!cockpitTarget}
          onClose={() => setCockpitTarget(null)}
          subjectName={cockpitTarget.subject}
          subjectColor={cockpitTarget.color}
          topic={cockpitTarget.topic}
          onSaveTopic={handleSaveTopicCockpit}
          parentBreadcrumbLabel="Edital Verticalizado"
          parentBreadcrumbHref="/edital"
        />
      )}
    </div>
  );
};

export default EditalPage;
