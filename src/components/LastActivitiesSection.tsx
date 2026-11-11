'use client';

import React from 'react';
import { useData } from '../context/DataContext';
import Link from 'next/link';
import { History, Clock, Calendar, ChevronRight, ExternalLink } from 'lucide-react';
import { findTopicNotebookUrl } from '../lib/scoreEngine';

const LastActivitiesSection = () => {
  const { studyRecords, stats, formatMinutesToHoursMinutes } = useData();

  const latestActivities = [...studyRecords]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Últimos Estudos Registrados
          </h2>
        </div>
        {studyRecords.length > 0 && (
          <Link
            href="/historico"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            Ver histórico <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {latestActivities.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e] text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma sessão de estudo registrada ainda.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-[#1a293e]">
          {latestActivities.map((activity) => {
            const notebookUrl = findTopicNotebookUrl(
              stats?.editalData,
              activity.subject,
              activity.topic
            );
            return (
              <div
                key={activity.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/materias/${encodeURIComponent(activity.subject)}`}
                      className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-500 transition-colors truncate"
                    >
                      {activity.subject}
                    </Link>
                    {activity.category === 'revisao' && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 text-[9px] font-extrabold uppercase">
                        Revisão
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activity.topic}
                    </p>
                    {notebookUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = notebookUrl.startsWith('http')
                            ? notebookUrl
                            : `https://${notebookUrl}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        title="Abrir Caderno de Questões deste tópico"
                        className="p-1 rounded-md bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors shrink-0"
                      >
                        <ExternalLink size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Clock size={12} className="text-emerald-500" />
                    {formatMinutesToHoursMinutes(activity.studyTime / 60000)}
                  </span>
                  {activity.questions && activity.questions.total > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                      {activity.questions.correct}/{activity.questions.total} q
                    </span>
                  )}
                  <span className="text-[11px] hidden sm:inline flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(activity.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LastActivitiesSection;
