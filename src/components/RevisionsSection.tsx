'use client';

import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import Link from 'next/link';
import {
  RotateCcw,
  ChevronRight,
  CalendarCheck,
  ExternalLink,
  Play,
  Calendar,
} from 'lucide-react';
import { computeTopicScore, findTopicNotebookUrl } from '../lib/scoreEngine';

const RevisionsSection = () => {
  const {
    reviewRecords,
    studyRecords,
    simuladoRecords,
    stats,
    setInitialStudyRecord,
    setIsRegisterModalOpen,
  } = useData();

  const { dueTodayList, upcomingNextDaysList } = useMemo(() => {
    const editalSubjects = stats?.editalData || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allEvaluated: {
      key: string;
      subject: string;
      topic: string;
      diffDays: number;
      currentScore: number;
      retention: number;
      tipBadge: string;
      notebookUrl: string | null;
    }[] = [];

    const seenKeys = new Set<string>();

    const evaluateTopic = (subjName: string, topicText: string, topicObj?: any) => {
      const key = `${subjName}::${topicText}`;
      if (seenKeys.has(key)) return;
      const subjRecs = (studyRecords || []).filter((r) => r.subject === subjName);
      const tRecs = subjRecs.filter((r) => r.topic === topicText);

      const pendingRev = (reviewRecords || [])
        .filter(
          (r) =>
            r.subject === subjName &&
            r.topic === topicText &&
            !r.completedDate &&
            !r.ignored &&
            r.status !== 'completed' &&
            r.scheduledDate
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0];

      if (tRecs.length === 0 && !pendingRev && !topicObj?.is_completed) return;
      seenKeys.add(key);

      const mapped = tRecs.map((r) => ({
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
        topicObj?.notes && String(topicObj.notes).replace(/<[^>]*>/g, '').trim().length > 0
      );

      const scoreRes = computeTopicScore(
        mapped,
        topicObj?.relevance ?? 3,
        topicObj?.difficulty ?? 3,
        topicObj?.perceivedMastery ?? topicObj?.mastery ?? 3,
        {
          subjectRecords: subjRecs,
          allStudyRecords: studyRecords || [],
          simuladoRecords: simuladoRecords || [],
          subjectName: subjName,
          hasNotes,
        }
      );

      const targetDateStr = pendingRev?.scheduledDate || scoreRes.nextReviewDate;
      let diffDays = scoreRes.daysUntilReview;
      if (targetDateStr) {
        const [y, m, d] = targetDateStr.split('-').map(Number);
        const target = new Date(y, m - 1, d, 0, 0, 0, 0);
        diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      const notebookUrl =
        topicObj?.notebookUrl || findTopicNotebookUrl(editalSubjects, subjName, topicText);

      allEvaluated.push({
        key,
        subject: subjName,
        topic: topicText,
        diffDays,
        currentScore: scoreRes.currentScore,
        retention: scoreRes.retention,
        tipBadge: scoreRes.scientificReviewTip.badge,
        notebookUrl: notebookUrl || null,
      });
    };

    const traverse = (topics: any[], subjName: string) => {
      for (const t of topics || []) {
        evaluateTopic(subjName, t.topic_text, t);
        if (t.sub_topics && t.sub_topics.length > 0) {
          traverse(t.sub_topics, subjName);
        }
      }
    };

    editalSubjects.forEach((subj: any) => {
      traverse(subj.topics || [], subj.subject);
    });

    (studyRecords || []).forEach((r) => {
      if (r.subject && r.topic) {
        evaluateTopic(r.subject, r.topic);
      }
    });

    const due = allEvaluated
      .filter((i) => i.diffDays <= 0 || i.currentScore < 65)
      .sort((a, b) => a.diffDays - b.diffDays);

    const upcoming = allEvaluated
      .filter((i) => i.diffDays > 0 && i.currentScore >= 65)
      .sort((a, b) => a.diffDays - b.diffDays);

    return {
      dueTodayList: due,
      upcomingNextDaysList: upcoming.slice(0, 4),
    };
  }, [stats?.editalData, studyRecords, simuladoRecords, reviewRecords]);

  const handleStartReview = (subject: string, topic: string) => {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')}`;
    if (setInitialStudyRecord) {
      setInitialStudyRecord({
        subject,
        topic,
        category: 'revisao',
        countInPlanning: false,
        date: todayLocal,
        studyTime: 0,
      });
    }
    setIsRegisterModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Revisões do Dia & Próximas
          </h2>
          {dueTodayList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-extrabold">
              {dueTodayList.length} hoje
            </span>
          )}
        </div>
        <Link
          href="/revisoes"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
        >
          Ver todas as revisões <ChevronRight size={14} />
        </Link>
      </div>

      {/* Revisões para Hoje / Urgentes */}
      {dueTodayList.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
            <CalendarCheck size={16} />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Sem revisões pendentes para hoje. Tudo em dia!
          </span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {dueTodayList.slice(0, 5).map((item) => {
            const isOverdue = item.diffDays < 0;
            return (
              <div
                key={item.key}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/materias/${encodeURIComponent(item.subject)}`}
                      className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-500 transition-colors truncate"
                    >
                      {item.subject}
                    </Link>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOverdue
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}
                    >
                      {isOverdue
                        ? `Atrasada há ${Math.abs(item.diffDays)}d`
                        : 'Revisar Hoje'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Score {item.currentScore}/100 ({item.retention}% ret.)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5 font-medium">
                    {item.topic}
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5 truncate">
                    {item.tipBadge}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
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
                      className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartReview(item.subject, item.topic)}
                    title="Registrar revisão deste tópico"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Play size={11} className="fill-current" />
                    Revisar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumo Compacto: Próximos Dias */}
      {upcomingNextDaysList.length > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-[#1a293e] space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar size={12} className="text-indigo-400" />
            Previstas para os próximos dias
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {upcomingNextDaysList.map((up) => (
              <div
                key={up.key}
                className="px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-[#0c1421]/60 border border-slate-100 dark:border-[#1a293e] flex items-center justify-between gap-2 text-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block truncate">
                    {up.subject}
                  </span>
                  <span className="text-slate-400 block truncate text-[10px]">
                    {up.topic}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {up.notebookUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = up.notebookUrl!.startsWith('http')
                          ? up.notebookUrl!
                          : `https://${up.notebookUrl!}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      title="Abrir Caderno de Questões"
                      className="p-1 rounded text-indigo-500 hover:text-indigo-400"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                    em {up.diffDays}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionsSection;
