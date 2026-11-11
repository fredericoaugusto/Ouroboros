import React, { useState, Fragment, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  ExternalLink,
  Check,
  Sliders,
} from 'lucide-react';
import { StudyRecord, EditalTopic as Topic } from '../context/DataContext';
import { computeTopicScore } from '../lib/scoreEngine';

interface TopicRowProps {
  topic: Topic & {
    topic_number?: string;
    relevance?: number;
    difficulty?: number;
    mastery?: number;
    notebookUrl?: string;
    notes?: string;
    status?: string;
  };
  subjectName: string;
  level: number;
  studyRecords?: StudyRecord[];
  onToggleCompletion: (subject: string, topic: string) => void;
  onOpenRegisterModal: (subject: string, topic: Topic) => void;
  onOpenCockpit?: (subject: string, topic: any) => void;
  allTopicsExpanded?: boolean;
}

const TopicRow: React.FC<TopicRowProps> = ({
  topic,
  subjectName,
  level,
  studyRecords = [],
  onToggleCompletion,
  onOpenRegisterModal,
  onOpenCockpit,
  allTopicsExpanded,
}) => {
  const [isExpanded, setIsExpanded] = useState(
    allTopicsExpanded !== undefined ? allTopicsExpanded : true
  );
  const hasSubtopics = !!(topic.sub_topics && topic.sub_topics.length > 0);

  useEffect(() => {
    if (allTopicsExpanded !== undefined) {
      setIsExpanded(allTopicsExpanded);
    }
  }, [allTopicsExpanded]);

  const subjectRecords = useMemo(
    () => studyRecords.filter((r) => r.subject === subjectName),
    [studyRecords, subjectName]
  );

  const topicRecords = useMemo(
    () => subjectRecords.filter((r) => r.topic === topic.topic_text),
    [subjectRecords, topic.topic_text]
  );

  const scoreRes = useMemo(() => {
    const mapped = topicRecords.map((r) => ({
      date: r.date,
      studyTime: r.studyTime || 0,
      questions: {
        correct: r.questions?.correct ?? (r as any).correctQuestions ?? 0,
        total:
          r.questions?.total ??
          ((r as any).correctQuestions || 0) + ((r as any).incorrectQuestions || 0),
      },
    }));
    return computeTopicScore(
      mapped,
      topic.relevance ?? 3,
      topic.difficulty ?? 3,
      (topic as any).perceivedMastery ?? topic.mastery ?? 3,
      {
        subjectRecords,
        allStudyRecords: studyRecords,
        subjectName,
      }
    );
  }, [
    topicRecords,
    topic.relevance,
    topic.difficulty,
    (topic as any).perceivedMastery,
    topic.mastery,
    subjectRecords,
    studyRecords,
    subjectName,
  ]);

  const completedQ = topic.completed ?? scoreRes.correctQuestions;
  const totalQ =
    (topic.completed !== undefined && topic.reviewed !== undefined
      ? topic.completed + topic.reviewed
      : scoreRes.totalQuestions) || 0;
  const wrongQ = Math.max(0, totalQ - completedQ);
  const percentageCorrect = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;

  const isCompleted = Boolean(topic.is_completed);
  const hasStudiedData = isCompleted || topicRecords.length > 0 || totalQ > 0;
  const hasNotes = !!(topic.notes && topic.notes.replace(/<[^>]*>/g, '').trim().length > 0);

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === '-') return '—';
    const parts = dateString.split('T')[0].split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <Fragment>
      <tr
        className={`group border-b border-slate-100 dark:border-[#1f304a] transition-colors ${
          isCompleted
            ? 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]'
            : 'hover:bg-slate-50/80 dark:hover:bg-[#17263f]/50'
        }`}
      >
        {/* Topic Name & Hierarchy */}
        <td
          className="py-3 px-4 text-xs text-slate-800 dark:text-slate-100"
          style={{ paddingLeft: `${level * 22 + 16}px` }}
        >
          <div className="flex items-center gap-2">
            {hasSubtopics ? (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}

            <button
              type="button"
              onClick={() => onToggleCompletion(subjectName, topic.topic_text)}
              className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 bg-white dark:bg-[#0b1320]'
              }`}
              title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluído'}
            >
              {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
            </button>

            {topic.topic_number && (
              <span className="font-mono text-[11px] font-bold text-emerald-500 shrink-0">
                {topic.topic_number}
              </span>
            )}

            <button
              type="button"
              onClick={() => onOpenCockpit && onOpenCockpit(subjectName, topic)}
              className={`text-left hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors ${
                hasSubtopics ? 'font-bold' : 'font-medium'
              } ${isCompleted ? 'text-slate-900 dark:text-white' : ''}`}
            >
              {topic.topic_text}
            </button>

            {hasNotes && (
              <button
                type="button"
                onClick={() => onOpenCockpit && onOpenCockpit(subjectName, topic)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 text-[10px] font-semibold shrink-0"
                title="Abrir resumo / anotações"
              >
                <FileText className="w-2.5 h-2.5" />
                Resumo
              </button>
            )}

            {topic.notebookUrl && (
              <a
                href={topic.notebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/25 shrink-0"
                title="Abrir Caderno de Questões no navegador"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Caderno
              </a>
            )}
          </div>
        </td>

        {/* Correct / Wrong / Total */}
        <td className="py-3 px-3 text-center text-xs whitespace-nowrap">
          {totalQ > 0 ? (
            <span className="font-mono">
              <strong className="text-emerald-500">{completedQ}</strong>
              <span className="text-slate-400"> / </span>
              <span className="text-rose-400">{wrongQ}</span>
              <span className="text-slate-400 text-[11px] ml-1">({totalQ})</span>
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        {/* Accuracy % */}
        <td className="py-3 px-3 text-center whitespace-nowrap">
          {totalQ > 0 ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                percentageCorrect >= 75
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : percentageCorrect >= 50
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {percentageCorrect}%
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>

        {/* Score & Retenção */}
        <td className="py-3 px-3 text-center whitespace-nowrap">
          {hasStudiedData ? (
            <button
              type="button"
              onClick={() => onOpenCockpit && onOpenCockpit(subjectName, topic)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border transition-transform hover:scale-105 ${
                scoreRes.color === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : scoreRes.color === 'amber'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
              title="Clique para abrir o Cockpit e ver detalhes do Score e Retenção"
            >
              <span>{scoreRes.currentScore} pts</span>
              <span className="opacity-75 font-semibold text-[10px]">
                ({scoreRes.retention}% ret.)
              </span>
            </button>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>

        {/* Last Study */}
        <td className="py-3 px-3 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatDate(topic.last_study || scoreRes.lastStudyDate || undefined)}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center justify-end gap-1.5">
            {onOpenCockpit && (
              <button
                type="button"
                onClick={() => onOpenCockpit(subjectName, topic)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                title="Abrir Cockpit (Anotações, Score, Relevância e Caderno)"
              >
                <Sliders className="w-3 h-3" />
                Cockpit
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenRegisterModal(subjectName, topic)}
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
              title="Registrar Estudo neste Tópico"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {hasSubtopics &&
        isExpanded &&
        topic.sub_topics!.map((subTopic, index) => (
          <TopicRow
            key={`${subTopic.topic_text}-${index}`}
            topic={subTopic}
            subjectName={subjectName}
            level={level + 1}
            studyRecords={studyRecords}
            onToggleCompletion={onToggleCompletion}
            onOpenRegisterModal={onOpenRegisterModal}
            onOpenCockpit={onOpenCockpit}
            allTopicsExpanded={allTopicsExpanded}
          />
        ))}
    </Fragment>
  );
};

export default TopicRow;
