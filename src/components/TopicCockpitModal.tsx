'use client';

import React, { useState, useMemo, useRef } from 'react';
import { computeTopicScore, TopicScoreResult } from '../lib/scoreEngine';
import TopicNotesEditor from './TopicNotesEditor';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import { useNotification } from '../context/NotificationContext';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Check,
  Save,
} from 'lucide-react';

export interface TopicData {
  topic_text: string;
  is_completed?: boolean;
  status?: 'not_started' | 'studying' | 'completed' | 'in_progress' | 'studied';
  relevance?: number; // 0 a 5
  difficulty?: number; // 0 a 5
  perceivedMastery?: number; // 0 a 5
  questionsTotal?: number;
  questionsCorrect?: number;
  notebookUrl?: string;
  notes?: string;
  lastStudiedDate?: string;
  daysWithStudy?: number;
}

export type TopicMetadata = TopicData;

interface TopicCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectColor?: string;
  topic: TopicData | null;
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

  const normalizeStatus = (t: TopicData | null): 'not_started' | 'studying' | 'completed' => {
    if (!t) return 'not_started';
    if (t.is_completed || t.status === 'completed' || t.status === 'studied') return 'completed';
    if (t.status === 'studying' || t.status === 'in_progress') return 'studying';
    return 'not_started';
  };

  const [relevance, setRelevance] = useState(topic?.relevance ?? 3);
  const [difficulty, setDifficulty] = useState(topic?.difficulty ?? 3);
  const [perceivedMastery, setPerceivedMastery] = useState(topic?.perceivedMastery ?? 3);
  const [notebookUrl, setNotebookUrl] = useState(topic?.notebookUrl || '');
  const [status, setStatus] = useState<'not_started' | 'studying' | 'completed'>(
    normalizeStatus(topic)
  );
  const [questionsTotal, setQuestionsTotal] = useState(topic?.questionsTotal ?? 0);
  const [questionsCorrect, setQuestionsCorrect] = useState(topic?.questionsCorrect ?? 0);
  const [notes, setNotes] = useState(topic?.notes || '');

  const currentTopicIdentity = `${subjectName}::${topic?.topic_text || ''}`;
  const lastSyncedIdentityRef = useRef<string>('');

  // Sincroniza apenas quando muda de tópico (ou abre um tópico diferente)
  React.useEffect(() => {
    if (!topic) return;
    if (lastSyncedIdentityRef.current !== currentTopicIdentity) {
      lastSyncedIdentityRef.current = currentTopicIdentity;
      setRelevance(topic.relevance ?? 3);
      setDifficulty(topic.difficulty ?? 3);
      setPerceivedMastery(topic.perceivedMastery ?? 3);
      setNotebookUrl(topic.notebookUrl || '');
      setStatus(normalizeStatus(topic));
      setQuestionsTotal(topic.questionsTotal ?? 0);
      setQuestionsCorrect(topic.questionsCorrect ?? 0);
      setNotes(topic.notes || '');
    }
  }, [topic, currentTopicIdentity]);

  const scoreResult = useMemo<TopicScoreResult>(() => {
    return computeTopicScore({
      perceivedMastery,
      relevance,
      difficulty,
      questionsTotal,
      questionsCorrect,
      lastStudiedDate: topic?.lastStudiedDate,
      daysWithStudy: topic?.daysWithStudy ?? 1,
    });
  }, [
    perceivedMastery,
    relevance,
    difficulty,
    questionsTotal,
    questionsCorrect,
    topic?.lastStudiedDate,
    topic?.daysWithStudy,
  ]);

  if (!isOpen || !topic) return null;

  const handleOpenNotebook = () => {
    if (!notebookUrl.trim()) {
      showNotification(
        'Cadastre a URL do seu caderno de questões (ex: QConcursos ou TEC).',
        'warning'
      );
      return;
    }
    const targetUrl = notebookUrl.startsWith('http')
      ? notebookUrl
      : `https://${notebookUrl}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const persistChanges = (overrides?: Partial<TopicData>, showToast = false) => {
    const payload: TopicData = {
      ...topic,
      relevance: overrides?.relevance ?? relevance,
      difficulty: overrides?.difficulty ?? difficulty,
      perceivedMastery: overrides?.perceivedMastery ?? perceivedMastery,
      notebookUrl: overrides?.notebookUrl ?? notebookUrl,
      status: overrides?.status ?? status,
      is_completed: (overrides?.status ?? status) === 'completed',
      questionsTotal: overrides?.questionsTotal ?? questionsTotal,
      questionsCorrect: overrides?.questionsCorrect ?? questionsCorrect,
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

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 z-30 bg-[#f8fafc] dark:bg-[#0b1320] overflow-y-auto p-4 sm:p-6 lg:p-8">
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                {subjectName}
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
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

        {/* Full-Page Grid: Left Sidebar (Bússola Metrics) + Right Full Notes Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
          {/* Left Column: Score Composition, Scales, Notebook, Questions */}
          <div className="lg:col-span-4 space-y-4">
            {/* Score Composition Card (Bússola Style) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" /> Composição do Score
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                    scoreResult.statusColor === 'green'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : scoreResult.statusColor === 'yellow'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}
                >
                  Score: {scoreResult.score}/100
                </span>
              </div>

              {/* Relevância 0-5 */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Relevância
                  </span>
                  <strong className="text-amber-500">{relevance}/5</strong>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map(val => (
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
                    Dificuldade
                  </span>
                  <strong className="text-rose-500">{difficulty}/5</strong>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map(val => (
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
                  {[0, 1, 2, 3, 4, 5].map(val => (
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
                    {weightCalculated}
                  </strong>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Relevância e dificuldade juntas decidem com que frequência este tópico volta para revisão.
                </p>
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
                onChange={e => setNotebookUrl(e.target.value)}
                onBlur={() => persistChanges({ notebookUrl })}
                placeholder="https://www.tecconcursos.com.br/..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={handleOpenNotebook}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <ExternalLink size={14} />
                Abrir Caderno em Nova Aba
              </button>
            </div>

            {/* Questions & Next Adaptive Review Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Questões
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={questionsTotal}
                    onChange={e => setQuestionsTotal(Number(e.target.value))}
                    onBlur={() => persistChanges({ questionsTotal })}
                    className="w-full text-center font-bold text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Acertos
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={questionsCorrect}
                    onChange={e => setQuestionsCorrect(Number(e.target.value))}
                    onBlur={() => persistChanges({ questionsCorrect })}
                    className="w-full text-center font-bold text-sm bg-transparent text-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Acerto
                  </span>
                  <span className="font-bold text-sm text-amber-500">
                    {questionsTotal > 0
                      ? `${Math.round((questionsCorrect / questionsTotal) * 100)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                <span className="text-indigo-400 font-semibold">Próxima revisão:</span>
                <strong className="text-indigo-300">
                  em {scoreResult.reviewIntervalDays} dias
                </strong>
              </div>
            </div>
          </div>

          {/* Right Column: Full-Size Rich Text Editor */}
          <div className="lg:col-span-8 flex flex-col min-h-[540px]">
            <TopicNotesEditor
              initialContent={notes}
              topicKey={currentTopicIdentity}
              onChange={newHtml => setNotes(newHtml)}
              onSave={newHtml => {
                setNotes(newHtml);
                persistChanges({ notes: newHtml }, true);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
