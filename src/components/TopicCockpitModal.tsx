'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  computeTopicScore,
  computeSubjectScore,
  TopicScoreResult,
} from '../lib/scoreEngine';
import TopicNotesEditor from './TopicNotesEditor';
import ScoreTutorialModal from './ScoreTutorialModal';
import QuestionStudioModal from './QuestionStudioModal';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import { useNotification } from '../context/NotificationContext';
import { useSidebar } from '../context/SidebarContext';
import { useData } from '../context/DataContext';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Save,
  HelpCircle,
  Activity,
  Award,
} from 'lucide-react';

export interface TopicData {
  topic_text: string;
  is_completed?: boolean;
  status?: 'not_started' | 'studying' | 'completed' | 'in_progress' | 'studied';
  relevance?: number; // 0 a 5
  difficulty?: number; // 0 a 5
  perceivedMastery?: number; // 0 a 5
  mastery?: number; // alias legado
  questionsTotal?: number;
  questionsCorrect?: number;
  notebookUrl?: string;
  notes?: string;
  lastStudiedDate?: string;
  daysWithStudy?: number;
  sub_topics?: TopicData[];
}

export type TopicMetadata = TopicData;

interface TopicCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectColor?: string;
  topic: TopicData | null;
  studyRecords?: any[];
  onSaveTopic?: (updatedTopic: TopicData) => void;
  onSave?: (updatedTopic: TopicData) => void;
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  parentBreadcrumbLabel?: string;
  parentBreadcrumbHref?: string;
}

export default function TopicCockpitModal({
  isOpen,
  onClose,
  subjectName,
  subjectColor = '#10b981',
  topic,
  onSaveTopic,
  onSave,
  onNavigatePrevious,
  onNavigateNext,
  hasPrevious = false,
  hasNext = false,
  parentBreadcrumbLabel = 'Disciplinas',
  parentBreadcrumbHref = '/materias',
}: TopicCockpitModalProps) {
  const { showNotification } = useNotification();
  const { isSidebarExpanded } = useSidebar();
  const { studyRecords: allStudyRecords, simuladoRecords, reviewRecords, stats } = useData();

  const normalizeStatus = (
    t: TopicData | null,
    hasRecords = false
  ): 'not_started' | 'studying' | 'completed' => {
    if (!t) return 'not_started';
    if (t.is_completed || t.status === 'completed' || t.status === 'studied') return 'completed';
    if (t.status === 'studying' || t.status === 'in_progress' || hasRecords) return 'studying';
    return 'not_started';
  };

  const [relevance, setRelevance] = useState(topic?.relevance ?? 3);
  const [difficulty, setDifficulty] = useState(topic?.difficulty ?? 3);
  const [perceivedMastery, setPerceivedMastery] = useState(
    topic?.perceivedMastery ?? topic?.mastery ?? 3
  );
  const [notebookUrl, setNotebookUrl] = useState(topic?.notebookUrl || '');
  const [status, setStatus] = useState<'not_started' | 'studying' | 'completed'>(
    normalizeStatus(topic)
  );
  const [notes, setNotes] = useState(topic?.notes || '');
  const [isScoreTutorialOpen, setIsScoreTutorialOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [studioInitialTab, setStudioInitialTab] = useState<'studio' | 'discursive'>('studio');

  const currentTopicIdentity = `${subjectName}::${topic?.topic_text || ''}`;
  const lastSyncedIdentityRef = useRef<string>('');

  // Coleta o nome do tópico e de eventuais subtópicos para somar o histórico real
  const matchingTopicNames = useMemo(() => {
    const names = new Set<string>();
    const collect = (node: TopicData | null | undefined) => {
      if (!node) return;
      if (node.topic_text) names.add(node.topic_text);
      if (node.sub_topics && node.sub_topics.length > 0) {
        node.sub_topics.forEach(collect);
      }
    };
    collect(topic);
    return names;
  }, [topic]);

  // Registros reais da disciplina e deste tópico extraídos do Histórico de Estudos
  const subjectRecords = useMemo(
    () => (allStudyRecords || []).filter((r) => r.subject === subjectName),
    [allStudyRecords, subjectName]
  );

  const topicRecords = useMemo(
    () => subjectRecords.filter((r) => matchingTopicNames.has(r.topic)),
    [subjectRecords, matchingTopicNames]
  );

  // Sincroniza apenas quando muda de tópico (ou abre um tópico diferente)
  React.useEffect(() => {
    if (!topic) return;
    if (lastSyncedIdentityRef.current !== currentTopicIdentity) {
      lastSyncedIdentityRef.current = currentTopicIdentity;
      setRelevance(topic.relevance ?? 3);
      setDifficulty(topic.difficulty ?? 3);
      setPerceivedMastery(topic.perceivedMastery ?? topic.mastery ?? 3);
      setNotebookUrl(topic.notebookUrl || '');
      setStatus(normalizeStatus(topic, topicRecords.length > 0));
      setNotes(topic.notes || '');
    }
  }, [topic, currentTopicIdentity, topicRecords.length]);

  // Calcula o Score e a Retenção reais do tópico com base em todo o histórico
  const hasNotesContent = Boolean(notes && notes.replace(/<[^>]*>/g, '').trim().length > 0);
  const scoreResult = useMemo<TopicScoreResult>(() => {
    return computeTopicScore(topicRecords, relevance, difficulty, perceivedMastery, {
      subjectRecords,
      allStudyRecords: allStudyRecords || [],
      simuladoRecords: simuladoRecords || [],
      subjectName,
      hasNotes: hasNotesContent,
    });
  }, [
    topicRecords,
    relevance,
    difficulty,
    perceivedMastery,
    subjectRecords,
    allStudyRecords,
    simuladoRecords,
    subjectName,
    hasNotesContent,
  ]);

  // Calcula também o Score e a Retenção Gerais da Disciplina (incluindo Simulados)
  const subjectScoreResult = useMemo(() => {
    const cleanSubj = (subjectName || '').trim().toLowerCase();
    const editalSubj = (stats?.editalData || []).find(
      (s) => (s.subject || '').trim().toLowerCase() === cleanSubj
    );
    return computeSubjectScore({
      subjectName,
      topics: editalSubj?.topics || [],
      studyRecords: allStudyRecords || [],
      simuladoRecords: simuladoRecords || [],
    });
  }, [stats?.editalData, subjectName, allStudyRecords, simuladoRecords]);

  if (!isOpen || !topic) return null;

  const handleOpenNotebook = () => {
    if (!notebookUrl.trim()) {
      showNotification(
        'Cadastre a URL do seu caderno de questões (ex: QConcursos ou TEC).',
        'error'
      );
      return;
    }
    const targetUrl = notebookUrl.startsWith('http')
      ? notebookUrl
      : `https://${notebookUrl}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const persistChanges = (overrides?: Partial<TopicData>, showToast = false) => {
    const nextStatus = overrides?.status ?? status;
    const nextMastery = overrides?.perceivedMastery ?? perceivedMastery;
    const payload: TopicData = {
      ...topic,
      relevance: overrides?.relevance ?? relevance,
      difficulty: overrides?.difficulty ?? difficulty,
      perceivedMastery: nextMastery,
      mastery: nextMastery,
      notebookUrl: overrides?.notebookUrl ?? notebookUrl,
      status: nextStatus,
      is_completed: nextStatus === 'completed',
      questionsTotal: scoreResult.totalQuestions,
      questionsCorrect: scoreResult.correctQuestions,
      notes: overrides?.notes !== undefined ? overrides.notes : notes,
    };

    if (onSaveTopic) onSaveTopic(payload);
    if (onSave) onSave(payload);

    if (showToast) {
      showNotification('Anotações e Score do tópico salvos!', 'success');
    }
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: parentBreadcrumbLabel, href: parentBreadcrumbHref },
    { label: subjectName, onClick: onClose },
    { label: `${topic.topic_text} (Notas)` },
  ];

  const weightCalculated = ((relevance + difficulty) / 2).toFixed(1);
  const questionsTotal = scoreResult.totalQuestions;
  const questionsCorrect = scoreResult.correctQuestions;
  const accuracyPct = Math.round(scoreResult.rawAccuracy * 100);

  return (
    <div
      className={`!mt-0 fixed top-0 right-0 bottom-14 ${
        isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
      } z-30 bg-[#f8fafc] dark:bg-[#0b1320] overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fadeIn transition-all duration-300`}
    >
      <div className="max-w-7xl mx-auto flex flex-col min-h-full">
        {/* Top Breadcrumbs + Quick Back & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <Breadcrumbs items={breadcrumbItems} className="mb-0" />

          <div className="flex items-center gap-2 shrink-0">
            {(hasPrevious || hasNext) && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={onNavigatePrevious}
                  disabled={!hasPrevious}
                  className="p-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] disabled:opacity-30 transition-colors"
                  title="Tópico Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  className="p-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] disabled:opacity-30 transition-colors"
                  title="Próximo Tópico"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <button
              onClick={() => persistChanges(undefined, true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
            >
              <Save size={14} />
              Salvar Tudo
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2942] text-xs font-semibold transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar para {subjectName}
            </button>
          </div>
        </div>

        {/* Header Banner */}
        <div className="bg-white dark:bg-[#131f33] rounded-2xl p-5 border border-slate-200 dark:border-[#1f304a] shadow-sm mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <span
              className="w-3.5 h-10 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: subjectColor }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {subjectName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#0b1320] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#1f304a]">
                  Score da Disciplina: {subjectScoreResult.subjectScore}/100 • Retenção Disciplina:{' '}
                  {subjectScoreResult.subjectRetention}%
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug mt-0.5">
                {topic.topic_text}
              </h1>
            </div>
          </div>

          {/* Status Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0b1320] rounded-xl border border-slate-200 dark:border-[#1f304a] shrink-0">
            <button
              type="button"
              onClick={() => {
                setStatus('not_started');
                persistChanges({ status: 'not_started' });
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                status === 'not_started'
                  ? 'bg-white dark:bg-[#1f304a] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Não iniciado
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('studying');
                persistChanges({ status: 'studying' });
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                status === 'studying'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Em estudo
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('completed');
                persistChanges({ status: 'completed' });
              }}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                status === 'completed'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Concluído
            </button>
          </div>
        </div>

        {/* Full-Page Grid: Left Sidebar (Metrics) + Right Full Notes Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          {/* Left Column: Score & Retention, Scales, Notebook, Read-Only Questions */}
          <div className="lg:col-span-4 space-y-4">
            {/* Score & Retention Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" /> Score & Retenção
                </span>
                <button
                  type="button"
                  onClick={() => setIsScoreTutorialOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline"
                  title="Ver apresentação de como o Score e a Retenção funcionam"
                >
                  <HelpCircle size={13} />
                  Como funciona?
                </button>
              </div>

              {/* Dual Metric Boxes: Score do Tópico & Retenção Atual */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Sua Nota Hoje (Score)
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-2xl font-extrabold ${
                        scoreResult.color === 'emerald'
                          ? 'text-emerald-500'
                          : scoreResult.color === 'amber'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {scoreResult.currentScore}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      / 100
                    </span>
                  </div>
                  {scoreResult.forgettingPenalty > 0 ? (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Quando estudou era <strong>{scoreResult.baseScore}</strong> (-{scoreResult.forgettingPenalty} pelo tempo)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Força geral neste assunto
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Activity size={11} className="text-indigo-400" />
                    Memória Fresca Hoje
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span
                      className={`text-2xl font-extrabold ${
                        scoreResult.retention >= 75
                          ? 'text-emerald-500'
                          : scoreResult.retention >= 50
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {scoreResult.retention}%
                    </span>
                    <span className="text-[10px] text-slate-400">lembrança</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Segura bem por ~<strong>{scoreResult.memoryStabilityDays} dias</strong>
                  </span>
                </div>
              </div>

              {/* Diagnóstico Intuitivo: O que está fazendo o Score subir ou cair? */}
              {scoreResult.impactFactors && scoreResult.impactFactors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Por que sua nota está assim? (O que faz subir ou cair)
                  </span>
                  <div className="space-y-2">
                    {scoreResult.impactFactors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] leading-relaxed flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/60 dark:border-[#1f304a]"
                      >
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 mt-0.5 ${
                            factor.type === 'positive'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : factor.type === 'negative'
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-indigo-500/15 text-indigo-400'
                          }`}
                        >
                          {factor.type === 'positive'
                            ? '▲ Sobe'
                            : factor.type === 'negative'
                            ? '▼ Cai'
                            : '• Aviso'}
                        </span>
                        <div>
                          <strong
                            className={`block ${
                              factor.type === 'positive'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : factor.type === 'negative'
                                ? 'text-rose-500 dark:text-rose-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {factor.label}
                          </strong>
                          <span className="text-slate-500 dark:text-slate-400">
                            {factor.detail}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relevância 0-5 */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Relevância na prova
                  </span>
                  <strong className="text-amber-500">{relevance}/5</strong>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setRelevance(val);
                        persistChanges({ relevance: val });
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        relevance === val
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dificuldade 0-5 */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Dificuldade pessoal
                  </span>
                  <strong className="text-rose-500">{difficulty}/5</strong>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setDifficulty(val);
                        persistChanges({ difficulty: val });
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        difficulty === val
                          ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Domínio Declarado 0-5 */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Domínio declarado
                  </span>
                  <strong className="text-emerald-500">{perceivedMastery}/5</strong>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setPerceivedMastery(val);
                        persistChanges({ perceivedMastery: val });
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        perceivedMastery === val
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-500 hover:border-slate-400'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#1f304a] text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Peso na preparação:</span>
                  <strong className="text-slate-800 dark:text-white">
                    {weightCalculated} / 5.0
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Score geral de {subjectName}:</span>
                  <strong className="text-emerald-500">
                    {subjectScoreResult.subjectScore}/100 ({subjectScoreResult.subjectRetention}% ret.)
                  </strong>
                </div>
              </div>
            </div>

            {/* External Question Notebook Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  Caderno de Questões
                </span>
                <span className="text-[10px] text-slate-400">TEC / QConcursos</span>
              </div>

              <input
                type="url"
                value={notebookUrl}
                onChange={(e) => setNotebookUrl(e.target.value)}
                onBlur={() => persistChanges({ notebookUrl })}
                placeholder="https://www.tecconcursos.com.br/..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleOpenNotebook}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <ExternalLink size={14} />
                  Abrir Caderno em Nova Aba
                </button>

                {/* Botão do Navegador/Estúdio temporariamente desabilitado na interface (lógica preservada para futura integração/extensão) */}
                {false && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudioInitialTab('studio');
                      setIsStudioModalOpen(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold flex items-center justify-center gap-2 transition-all"
                    title="Abrir Navegador e Estúdio Interativo em Tela Cheia (rolar página, selecionar texto p/ Notas, grifar texto e recortar prints)"
                  >
                    <Sparkles size={14} />
                    Abrir Navegador & Estúdio em Tela Cheia
                  </button>
                )}
              </div>
            </div>

            {/* Read-Only Questions from Study History & Next Adaptive Review Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  Desempenho no Histórico
                </span>
                <span className="text-[10px] text-slate-400">
                  {topicRecords.length} {topicRecords.length === 1 ? 'sessão' : 'sessões'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Questões
                  </span>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {questionsTotal}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Acertos
                  </span>
                  <span className="font-extrabold text-sm text-emerald-500">
                    {questionsCorrect}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Acerto
                  </span>
                  <span className="font-extrabold text-sm text-amber-500">
                    {questionsTotal > 0 ? `${accuracyPct}%` : '0%'}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Calculado automaticamente a partir dos seus registros de estudo neste tópico.
              </p>

              {(() => {
                const pendingRevs = (reviewRecords || [])
                  .filter(
                    (r) =>
                      r.subject === subjectName &&
                      matchingTopicNames.has(r.topic) &&
                      !r.completedDate &&
                      !r.ignored &&
                      r.status !== 'completed' &&
                      r.scheduledDate
                  )
                  .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

                const pendingRev = pendingRevs[0];
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let effectiveCountdown = scoreResult.daysUntilReview;
                if (pendingRev?.scheduledDate) {
                  const [y, m, d] = pendingRev.scheduledDate.split('-').map(Number);
                  const target = new Date(y, m - 1, d, 0, 0, 0, 0);
                  effectiveCountdown = Math.round(
                    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );
                }

                const formatBrDate = (iso?: string) => {
                  if (!iso) return '';
                  const [y, m, d] = String(iso).split('T')[0].split('-');
                  return d && m && y ? `${d}/${m}/${y}` : iso;
                };

                const sortedTopicHistory = [...topicRecords].sort((a, b) =>
                  String(b.date || '').localeCompare(String(a.date || ''))
                );

                return (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                      <span className="text-indigo-500 dark:text-indigo-400 font-semibold">
                        Próxima revisão pelo Score:
                      </span>
                      <strong className="text-indigo-600 dark:text-indigo-300">
                        {topicRecords.length === 0 && !pendingRev
                          ? `após 1º estudo (~${scoreResult.reviewIntervalDays}d)`
                          : effectiveCountdown < 0
                          ? `atrasada há ${Math.abs(effectiveCountdown)}d`
                          : effectiveCountdown === 0
                          ? 'revisar hoje!'
                          : `em ${effectiveCountdown} ${
                              effectiveCountdown === 1 ? 'dia' : 'dias'
                            }`}
                      </strong>
                    </div>

                    {/* Próximas Revisões Previstas / Cadastradas neste Tópico */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Próximas Revisões Previstas neste Tópico
                      </span>
                      {pendingRevs.length > 0 ? (
                        <div className="space-y-1.5">
                          {pendingRevs.map((rev) => {
                            const [ry, rm, rd] = rev.scheduledDate.split('-').map(Number);
                            const rDate = new Date(ry, rm - 1, rd, 0, 0, 0, 0);
                            const rDiff = Math.round(
                              (rDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                            );
                            return (
                              <div
                                key={rev.id}
                                className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/70 dark:border-[#1f304a]"
                              >
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  📅 {formatBrDate(rev.scheduledDate)}
                                </span>
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                    rDiff < 0
                                      ? 'bg-rose-500/15 text-rose-500'
                                      : rDiff === 0
                                      ? 'bg-amber-500/15 text-amber-500'
                                      : 'bg-emerald-500/15 text-emerald-500'
                                  }`}
                                >
                                  {rDiff < 0
                                    ? `Atrasada (${Math.abs(rDiff)}d)`
                                    : rDiff === 0
                                    ? 'Hoje'
                                    : `Em ${rDiff}d (${rev.reviewPeriod || 'Score'})`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : topicRecords.length > 0 && scoreResult.nextReviewDate ? (
                        <div className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/70 dark:border-[#1f304a]">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            📅 {formatBrDate(scoreResult.nextReviewDate)} (Automática pelo Score)
                          </span>
                          <span className="font-bold text-emerald-500 text-[10px]">
                            Ciclo de {scoreResult.reviewIntervalDays}d
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">
                          Nenhuma revisão agendada ainda. Registre seu 1º estudo para iniciar o ciclo automático.
                        </p>
                      )}
                    </div>

                    {/* Dica Científica de Revisão para este Tópico */}
                    <div className="p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                        {scoreResult.scientificReviewTip.badge}
                      </span>
                      <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                        {scoreResult.scientificReviewTip.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {scoreResult.scientificReviewTip.description}
                      </p>
                    </div>

                    {/* Histórico de Revisões e Estudos deste Tópico */}
                    {sortedTopicHistory.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                          Histórico de Revisões & Estudos deste Tópico ({sortedTopicHistory.length})
                        </span>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {sortedTopicHistory.map((rec, idx) => {
                            const c = rec.questions?.correct ?? (rec as any).correctQuestions ?? 0;
                            const t =
                              rec.questions?.total ??
                              c + ((rec as any).incorrectQuestions ?? 0);
                            const mins = Math.round((rec.studyTime || 0) / 60000);
                            const isRev = rec.category === 'revisao';
                            return (
                              <div
                                key={rec.id || idx}
                                className="p-2 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200/70 dark:border-[#1f304a] text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                        isRev
                                          ? 'bg-indigo-500/15 text-indigo-400'
                                          : 'bg-emerald-500/15 text-emerald-500'
                                      }`}
                                    >
                                      {isRev ? 'Revisão' : rec.category || 'Estudo'}
                                    </span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {formatBrDate(rec.date)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    {mins > 0 && <span>⏱ {mins}m</span>}
                                    {t > 0 && (
                                      <strong className="text-emerald-500">
                                        {c}/{t} ({Math.round((c / t) * 100)}%)
                                      </strong>
                                    )}
                                  </div>
                                </div>
                                {rec.notes && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate">
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
              })()}
            </div>
          </div>

          {/* Right Column: Full-Size Rich Text Editor */}
          <div className="lg:col-span-8 flex flex-col min-h-[540px]">
            <TopicNotesEditor
              initialContent={notes}
              topicKey={currentTopicIdentity}
              onChange={(newHtml) => setNotes(newHtml)}
              onSave={(newHtml) => {
                setNotes(newHtml);
                persistChanges({ notes: newHtml }, true);
              }}
            />
          </div>
        </div>
      </div>

      <ScoreTutorialModal
        isOpen={isScoreTutorialOpen}
        onClose={() => setIsScoreTutorialOpen(false)}
      />

      <QuestionStudioModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        subjectName={subjectName}
        topicName={topic.topic_text}
        notebookUrl={notebookUrl}
        currentNotes={notes}
        initialTab={studioInitialTab}
        onAppendToNotes={(htmlSnippet) => {
          const nextNotes = `${notes || ''}${htmlSnippet}`;
          setNotes(nextNotes);
          persistChanges({ notes: nextNotes }, false);
        }}
      />
    </div>
  );
}
