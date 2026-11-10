'use client';

import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import Link from 'next/link';
import { RotateCcw, Check, X, ChevronRight, CalendarCheck } from 'lucide-react';

const RevisionsSection = () => {
  const { reviewRecords, updateReviewRecord } = useData();

  const todaysReviewRecords = useMemo(() => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return reviewRecords
      .filter((record) => {
        const [rYear, rMonth, rDay] = record.scheduledDate.split('-').map(Number);
        const recordDateUtc = new Date(Date.UTC(rYear, rMonth - 1, rDay));
        return recordDateUtc.getTime() <= todayUtc.getTime() && !record.completedDate && !record.ignored;
      })
      .sort((a, b) => {
        const [aYear, aMonth, aDay] = a.scheduledDate.split('-').map(Number);
        const dateA = new Date(Date.UTC(aYear, aMonth - 1, aDay));
        const [bYear, bMonth, bDay] = b.scheduledDate.split('-').map(Number);
        const dateB = new Date(Date.UTC(bYear, bMonth - 1, bDay));
        return dateA.getTime() - dateB.getTime();
      });
  }, [reviewRecords]);

  const handleCompleteReview = (id: string) => {
    const recordToUpdate = reviewRecords.find((record) => record.id === id);
    if (recordToUpdate) {
      updateReviewRecord({
        ...recordToUpdate,
        completedDate: new Date().toISOString().split('T')[0],
        ignored: false,
      });
    }
  };

  const handleIgnoreReview = (id: string) => {
    const recordToUpdate = reviewRecords.find((record) => record.id === id);
    if (recordToUpdate) {
      updateReviewRecord({ ...recordToUpdate, ignored: true, completedDate: undefined });
    }
  };

  const getDaysOverdue = (scheduledDate: string) => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [sYear, sMonth, sDay] = scheduledDate.split('-').map(Number);
    const scheduledDateUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay));
    const diffTime = todayUtc.getTime() - scheduledDateUtc.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Revisões do Dia
          </h2>
        </div>
        <Link
          href="/revisoes"
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
        >
          Ver todas as revisões <ChevronRight size={14} />
        </Link>
      </div>

      {todaysReviewRecords.length === 0 ? (
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
          {todaysReviewRecords.map((record) => {
            const daysOverdue = getDaysOverdue(record.scheduledDate);
            const isOverdue = daysOverdue > 0;

            return (
              <div
                key={record.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {record.subject}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOverdue
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      }`}
                    >
                      {isOverdue ? `Atrasada há ${daysOverdue}d` : 'Hoje'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {record.topic}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCompleteReview(record.id)}
                    title="Concluir revisão"
                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleIgnoreReview(record.id)}
                    title="Ignorar revisão"
                    className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RevisionsSection;
