'use client';

import React, { useState, useMemo } from 'react';
import { useData, StudyRecord, ReviewRecord } from '../../context/DataContext';
import {
  RotateCcw,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  TrendingDown,
  FileText,
  ExternalLink,
  Sliders,
  Sparkles,
  Clock,
  HelpCircle,
} from 'lucide-react';
import StudyRegisterModal from '../../components/StudyRegisterModal';
import TopicCockpitModal, { TopicMetadata } from '../../components/TopicCockpitModal';
import ScoreTutorialModal from '../../components/ScoreTutorialModal';
import { computeTopicScore, TopicScoreResult } from '../../lib/scoreEngine';
import { updateTopicDetailsAction } from '../actions';
import { useNotification } from '../../context/NotificationContext';

interface AdaptiveReviewItem {
  subject: string;
  subjectColor: string;
  topicObj: any;
  topicText: string;
  scoreResult: TopicScoreResult;
  diffDays: number; // <= 0 means due today or overdue
  topicHistory: StudyRecord[];
  notebookUrl?: string;
}

export default function Revisao() {
  const {
    selectedDataFile,
    addStudyRecord,
    updateStudyRecord,
    studyRecords,
    simuladoRecords,
    reviewRecords,
    updateReviewRecord,
    stats,
    refreshPlans,
  } = useData();
  const { showNotification } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StudyRecord | null>(null);
  const [activeTab, setActiveTab] = useState<
    'due' | 'upcoming' | 'all_scores' | 'manual_completed'
  >('due');
  const [completingReviewId, setCompletingReviewId] = useState<string | null>(null);
  const [expandedHistoryKey, setExpandedHistoryKey] = useState<string | null>(null);
  const [cockpitTarget, setCockpitTarget] = useState<{
    subject: string;
    color: string;
    topic: any;
  } | null>(null);

  // Build adaptive reviews list from all studied topics across the active plan
  const adaptiveItems: AdaptiveReviewItem[] = useMemo(() => {
    const editalSubjects = stats.editalData || [];
    const items: AdaptiveReviewItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const traverse = (topics: any[], subjName: string, subjColor: string) => {
      const subjRecords = studyRecords.filter((r) => r.subject === subjName);
      for (const t of topics || []) {
        const tRecords = subjRecords.filter((r) => r.topic === t.topic_text);
        if (tRecords.length > 0 || t.is_completed || t.status === 'studied') {
          const mapped = tRecords.map((r) => ({
            date: r.date,
            studyTime: r.studyTime || 0,
            questions: {
              correct: r.questions?.correct ?? (r as any).correctQuestions ?? 0,
              total:
                r.questions?.total ??
                ((r as any).correctQuestions || 0) + ((r as any).incorrectQuestions || 0),
            },
          }));

          const hasNotes = Boolean(
            t.notes && String(t.notes).replace(/<[^>]*>/g, '').trim().length > 0
          );

          const scoreResult = computeTopicScore(
            mapped,
            t.relevance ?? 3,
            t.difficulty ?? 3,
            t.perceivedMastery ?? t.mastery ?? 3,
            {
              subjectRecords: subjRecords,
              allStudyRecords: studyRecords,
              simuladoRecords: simuladoRecords || [],
              subjectName: subjName,
              hasNotes,
            }
          );

          // Verifica se já há uma revisão pendente agendada em reviewRecords para este tópico
          const pendingScheduled = reviewRecords
            .filter(
              (r) =>
                r.subject === subjName &&
                r.topic === t.topic_text &&
                !r.completedDate &&
                !r.ignored &&
                r.status !== 'completed' &&
                r.scheduledDate
            )
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];

          const targetDateStr = pendingScheduled?.scheduledDate || scoreResult.nextReviewDate;

          let diffDays = scoreResult.daysUntilReview;
          if (targetDateStr) {
            const [y, m, d] = targetDateStr.split('-').map(Number);
            const nextDate = new Date(y, m - 1, d);
            nextDate.setHours(0, 0, 0, 0);
            diffDays = Math.round(
              (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          const sortedTopicHistory = [...tRecords].sort((a, b) =>
            String(b.date || '').localeCompare(String(a.date || ''))
          );

          items.push({
            subject: subjName,
            subjectColor: subjColor || '#10b981',
            topicObj: t,
            topicText: t.topic_text,
            scoreResult,
            diffDays,
            topicHistory: sortedTopicHistory,
            notebookUrl: t.notebookUrl ? String(t.notebookUrl).trim() : undefined,
          });
        }
        if (t.sub_topics && t.sub_topics.length > 0) {
          traverse(t.sub_topics, subjName, subjColor);
        }
      }
    };

    editalSubjects.forEach((subj: any) => {
      traverse(subj.topics || [], subj.subject, subj.color || '#10b981');
    });

    // Also include any studyRecords for topics not found in edital tree
    const seenKeys = new Set(items.map((i) => `${i.subject}::${i.topicText}`));
    const uniquePairs = new Map<string, { subject: string; topic: string }>();
    studyRecords.forEach((r) => {
      if (r.subject && r.topic) {
        const key = `${r.subject}::${r.topic}`;
        if (!seenKeys.has(key)) {
          uniquePairs.set(key, { subject: r.subject, topic: r.topic });
        }
      }
    });

    uniquePairs.forEach(({ subject, topic }) => {
      const subjRecords = studyRecords.filter((r) => r.subject === subject);
      const tRecords = subjRecords.filter((r) => r.topic === topic);
      const mapped = tRecords.map((r) => ({
        date: r.date,
        studyTime: r.studyTime || 0,
        questions: {
          correct: r.questions?.correct ?? (r as any).correctQuestions ?? 0,
          total:
            r.questions?.total ??
            ((r as any).correctQuestions || 0) + ((r as any).incorrectQuestions || 0),
        },
      }));
      const scoreResult = computeTopicScore(mapped, 3, 3, 3, {
        subjectRecords: subjRecords,
        allStudyRecords: studyRecords,
        simuladoRecords: simuladoRecords || [],
        subjectName: subject,
      });
      let diffDays = 0;
      if (scoreResult.nextReviewDate) {
        const [y, m, d] = scoreResult.nextReviewDate.split('-').map(Number);
        const nextDate = new Date(y, m - 1, d);
        nextDate.setHours(0, 0, 0, 0);
        diffDays = Math.round(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      const sortedTopicHistory = [...tRecords].sort((a, b) =>
        String(b.date || '').localeCompare(String(a.date || ''))
      );
      items.push({
        subject,
        subjectColor: '#10b981',
        topicObj: { topic_text: topic },
        topicText: topic,
        scoreResult,
        diffDays,
        topicHistory: sortedTopicHistory,
      });
    });

    return items.sort((a, b) => a.scoreResult.currentScore - b.scoreResult.currentScore);
  }, [stats.editalData, studyRecords, simuladoRecords, reviewRecords]);

  const dueItems = useMemo(
    () =>
      adaptiveItems
        .filter((i) => i.diffDays <= 0 || i.scoreResult.currentScore < 65)
        .sort((a, b) => a.diffDays - b.diffDays),
    [adaptiveItems]
  );

  const upcomingItems = useMemo(
    () =>
      adaptiveItems
        .filter((i) => i.diffDays > 0 && i.scoreResult.currentScore >= 65)
        .sort((a, b) => a.diffDays - b.diffDays),
    [adaptiveItems]
  );

  const handleStartAdaptiveReview = (item: AdaptiveReviewItem) => {
    const prefilled: Partial<StudyRecord> = {
      subject: item.subject,
      topic: item.topicText,
      category: 'revisao',
      countInPlanning: false,
    };
    setEditingRecord(prefilled as StudyRecord);
    setCompletingReviewId(null);
    setIsModalOpen(true);
  };

  const handleSave = (record: StudyRecord) => {
    if (editingRecord && editingRecord.id) {
      updateStudyRecord(record);
    } else {
      addStudyRecord(record);
    }

    if (completingReviewId) {
      const recordToUpdate = reviewRecords.find((r) => r.id === completingReviewId);
      if (recordToUpdate) {
        updateReviewRecord({
          ...recordToUpdate,
          completedDate: new Date().toISOString().split('T')[0],
          ignored: false,
        });
      }
    }

    setIsModalOpen(false);
    setEditingRecord(null);
    setCompletingReviewId(null);
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
      showNotification(`Erro: ${res.error}`, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Revisões Inteligentes (Motor de Score)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Esqueça revisões fixas engessadas (1, 7, 14 dias): seus tópicos voltam dinamicamente conforme seu Score decai pela curva de esquecimento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-500 transition-all shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-emerald-500" />
            Como funciona o Score?
          </button>

          <button
            onClick={() => {
              setEditingRecord(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Registrar Revisão Avulsa
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Para Revisar Hoje / Urgentes
            </span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {dueItems.length}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tópicos com revisão vencida ou Score &lt; 65
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Programadas pelo Score
            </span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {upcomingItems.length}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tópicos em memória ativa (próximos ciclos)
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
              Tópicos Monitorados
            </span>
            <div className="text-3xl font-extrabold text-emerald-500 mt-1">
              {adaptiveItems.length}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Total de tópicos com Score calculado
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-[#1f304a]">
        <button
          onClick={() => setActiveTab('due')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'due'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Para Revisar Agora ({dueItems.length})
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Próximas Revisões ({upcomingItems.length})
        </button>

        <button
          onClick={() => setActiveTab('all_scores')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'all_scores'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Ranking de Score ({adaptiveItems.length})
        </button>

        {reviewRecords.length > 0 && (
          <button
            onClick={() => setActiveTab('manual_completed')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'manual_completed'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Agendamentos Manuais ({reviewRecords.length})
          </button>
        )}
      </div>

      {/* List Content */}
      {activeTab !== 'manual_completed' ? (
        <div className="space-y-3">
          {(activeTab === 'due'
            ? dueItems
            : activeTab === 'upcoming'
            ? upcomingItems
            : adaptiveItems
          ).length === 0 ? (
            <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                {activeTab === 'due'
                  ? 'Nenhuma revisão urgente pendente!'
                  : 'Nenhum tópico nesta visualização ainda'}
              </h3>
              <p className="text-xs text-slate-400">
                Conforme você estuda e resolve questões, o Motor de Score agenda automaticamente suas próximas revisões ideais.
              </p>
            </div>
          ) : (
            (activeTab === 'due'
              ? dueItems
              : activeTab === 'upcoming'
              ? upcomingItems
              : adaptiveItems
            ).map((item, idx) => {
              const { scoreResult } = item;
              const itemKey = `${item.subject}::${item.topicText}`;
              const isHistoryExpanded = expandedHistoryKey === itemKey;
              const lastRecord = item.topicHistory?.[0] || null;
              const formatBrDate = (iso?: string) => {
                if (!iso) return '';
                const [y, m, d] = String(iso).split('T')[0].split('-');
                return d && m && y ? `${d}/${m}/${y}` : iso;
              };

              return (
                <div
                  key={`${item.subject}-${item.topicText}-${idx}`}
                  className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-5 flex flex-col gap-4 hover:border-slate-300 dark:hover:border-[#2c4266] transition-all shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-10 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: item.subjectColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-500">
                            {item.subject}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.diffDays < 0
                                ? 'bg-rose-500/15 text-rose-400'
                                : item.diffDays === 0
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {item.diffDays < 0
                              ? `Atrasada há ${Math.abs(item.diffDays)}d`
                              : item.diffDays === 0
                              ? 'Revisar Hoje'
                              : `Revisão em ${item.diffDays}d`}
                          </span>
                        </div>

                        <h3
                          onClick={() =>
                            setCockpitTarget({
                              subject: item.subject,
                              color: item.subjectColor,
                              topic: item.topicObj,
                            })
                          }
                          className="text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:text-emerald-500 cursor-pointer transition-colors mt-0.5"
                        >
                          {item.topicText}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5">
                          <span>
                            Questões:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {scoreResult.correctQuestions}/{scoreResult.totalQuestions}
                            </strong>{' '}
                            ({Math.round(scoreResult.rawAccuracy * 100)}%)
                          </span>
                          <span>
                            Retenção:{' '}
                            <strong className="text-indigo-500 dark:text-indigo-400">
                              {scoreResult.retention}%
                            </strong>
                          </span>
                          <span>
                            Estudado há:{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {scoreResult.daysSinceLastStudy}d
                            </strong>
                          </span>
                          <span title={`Taxa de decaimento λ = ${scoreResult.lambda.toFixed(3)}/dia`}>
                            Estabilidade (S):{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              ~{scoreResult.memoryStabilityDays}d
                            </strong>{' '}
                            <span className="text-[11px] text-slate-400">
                              (-{scoreResult.dailyDecayPercent}%/dia)
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Score & Actions */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-[#1f304a]">
                      {/* Score Pill */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Score Atual
                          </div>
                          <div className="flex items-baseline gap-1 justify-end">
                            <span
                              className={`text-lg font-extrabold ${
                                scoreResult.color === 'emerald'
                                  ? 'text-emerald-500'
                                  : scoreResult.color === 'amber'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {scoreResult.currentScore}
                            </span>
                            <span className="text-xs text-slate-400">/ 100</span>
                          </div>
                          {scoreResult.forgettingPenalty > 0 && (
                            <div className="text-[9px] text-slate-400">
                              Topo: {scoreResult.baseScore}/100 (-{scoreResult.forgettingPenalty})
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.notebookUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = item.notebookUrl!.startsWith('http')
                                ? item.notebookUrl!
                                : `https://${item.notebookUrl!}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            title="Abrir Caderno de Questões deste tópico"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/25 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Caderno de Questões
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setCockpitTarget({
                              subject: item.subject,
                              color: item.subjectColor,
                              topic: item.topicObj,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:bg-indigo-500 hover:text-white transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Resumo / Cockpit
                        </button>

                        {item.topicHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryKey(isHistoryExpanded ? null : itemKey)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 hover:text-emerald-500 transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Histórico ({item.topicHistory.length})
                          </button>
                        )}

                        <button
                          onClick={() => handleStartAdaptiveReview(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Revisar Agora
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dica Científica de Como Revisar + Resumo da Última Sessão */}
                  <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-[#0d1626] border border-slate-200/80 dark:border-[#1f304a] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                            scoreResult.scientificReviewTip.urgencyColor === 'rose'
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/25'
                              : scoreResult.scientificReviewTip.urgencyColor === 'amber'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                              : scoreResult.scientificReviewTip.urgencyColor === 'emerald'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25'
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                          }`}
                        >
                          {scoreResult.scientificReviewTip.badge}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Como revisar hoje: {scoreResult.scientificReviewTip.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {scoreResult.scientificReviewTip.description}
                      </p>
                    </div>

                    {lastRecord && (
                      <div className="md:border-l border-slate-200 dark:border-[#1f304a] md:pl-4 shrink-0 text-[11px] space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Último registro no tópico
                        </span>
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatBrDate(lastRecord.date)} •{' '}
                          <span className="uppercase text-emerald-500 font-bold">
                            {lastRecord.category === 'revisao'
                              ? 'Revisão'
                              : lastRecord.category || 'Estudo'}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {Math.round((lastRecord.studyTime || 0) / 60000)}m estudados
                          {lastRecord.questions && lastRecord.questions.total > 0
                            ? ` • ${lastRecord.questions.correct}/${
                                lastRecord.questions.total
                              } acertos (${Math.round(
                                (lastRecord.questions.correct / lastRecord.questions.total) * 100
                              )}%)`
                            : ''}
                        </div>
                        {lastRecord.notes && (
                          <div className="text-[10px] italic text-slate-400 max-w-xs truncate">
                            “{lastRecord.notes}”
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Painel Expansível: Histórico Completo de Revisões e Estudos deste Tópico */}
                  {isHistoryExpanded && item.topicHistory.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-2 animate-fadeIn">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Histórico de Sessões & Revisões neste Tópico ({item.topicHistory.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {item.topicHistory.map((rec, rIdx) => {
                          const c = rec.questions?.correct ?? (rec as any).correctQuestions ?? 0;
                          const t =
                            rec.questions?.total ??
                            c + ((rec as any).incorrectQuestions ?? 0);
                          const mins = Math.round((rec.studyTime || 0) / 60000);
                          return (
                            <div
                              key={rec.id || rIdx}
                              className="p-2.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/70 dark:border-[#1f304a] text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                    rec.category === 'revisao'
                                      ? 'bg-indigo-500/15 text-indigo-400'
                                      : 'bg-emerald-500/15 text-emerald-500'
                                  }`}
                                >
                                  {rec.category === 'revisao'
                                    ? 'Revisão'
                                    : rec.category || 'Estudo'}
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                                  {formatBrDate(rec.date)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>⏱ {mins} min</span>
                                {t > 0 ? (
                                  <strong className="text-emerald-500">
                                    {c}/{t} questões ({Math.round((c / t) * 100)}%)
                                  </strong>
                                ) : (
                                  <span>Sem questões</span>
                                )}
                              </div>
                              {rec.notes && (
                                <p className="text-[10px] italic text-slate-400 truncate">
                                  “{rec.notes}”
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Legacy/Manual Scheduled Reviews */
        <div className="space-y-3">
          {reviewRecords.map((rec) => (
            <div
              key={rec.id}
              className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200/80 dark:border-[#1f304a] p-4 flex items-center justify-between gap-4"
            >
              <div>
                <span className="text-xs font-bold text-emerald-500 uppercase">
                  {rec.subject}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {rec.topic}
                </h4>
                <p className="text-xs text-slate-400">
                  Agendada para: {new Date(rec.scheduledDate).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingRecord({
                    subject: rec.subject,
                    topic: rec.topic,
                    category: 'revisao',
                  } as StudyRecord);
                  setCompletingReviewId(rec.id);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold"
              >
                Concluir Revisão
              </button>
            </div>
          ))}
        </div>
      )}

      <StudyRegisterModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
          setCompletingReviewId(null);
        }}
        onSave={handleSave}
        initialRecord={editingRecord}
        showDeleteButton={!!editingRecord?.id}
      />

      {cockpitTarget && (
        <TopicCockpitModal
          isOpen={!!cockpitTarget}
          onClose={() => setCockpitTarget(null)}
          subjectName={cockpitTarget.subject}
          subjectColor={cockpitTarget.color}
          topic={cockpitTarget.topic}
          onSaveTopic={handleSaveTopicCockpit}
          parentBreadcrumbLabel="Revisões"
          parentBreadcrumbHref="/revisoes"
        />
      )}

      <ScoreTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />
    </div>
  );
}
