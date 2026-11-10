'use client';

import React, { useState } from 'react';
import {
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiChevronDown,
  FiChevronUp,
  FiAward,
  FiClock,
} from 'react-icons/fi';
import { SimuladoRecord } from '../app/actions';

interface SimuladoCardProps {
  simulado: SimuladoRecord;
  onEdit: (simulado: SimuladoRecord) => void;
  onDelete: (simulado: SimuladoRecord) => void;
}

const formatTime = (timeStr: string): string => {
  const parts = (timeStr || '').split(':').map(Number);
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    if (seconds > 0) return `${seconds}s`;
  }
  return '0m';
};

const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getPerformanceColor = (percentage: number): string => {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-cyan-500';
  return 'bg-rose-500';
};

export default function SimuladoCard({ simulado, onEdit, onDelete }: SimuladoCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalQuestions = simulado.subjects.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalCorrect = simulado.subjects.reduce((sum, s) => sum + s.correct, 0);
  const totalIncorrect = simulado.subjects.reduce((sum, s) => sum + s.incorrect, 0);
  const totalBlank = totalQuestions - totalCorrect - totalIncorrect;

  const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  const totalScore = simulado.subjects.reduce((sum, sub) => {
    if (simulado.style === 'Certo/Errado') {
      return sum + (sub.correct - sub.incorrect);
    } else {
      return sum + sub.correct * sub.weight;
    }
  }, 0);

  return (
    <div className="bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm overflow-hidden transition-all">
      <div
        className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-[#17263f]/40 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {simulado.name}
            </h3>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              {simulado.banca || 'Geral'} • {simulado.style}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Realizado em {formatDateDisplay(simulado.date)}
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0f1929] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
              <FiClock className="w-3.5 h-3.5 text-slate-400" />
              {formatTime(simulado.timeSpent)}
            </span>

            <div className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-50 dark:bg-[#0f1929] border border-slate-100 dark:border-[#1f304a]">
              <span className="flex items-center gap-1 text-emerald-500 font-bold">
                <FiCheckCircle className="w-3.5 h-3.5" /> {totalCorrect}
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <FiXCircle className="w-3.5 h-3.5" /> {totalIncorrect}
              </span>
              <span className="flex items-center gap-1 text-slate-400 font-bold">
                <FiMinusCircle className="w-3.5 h-3.5" /> {totalBlank}
              </span>
              <span className="flex items-center gap-1 text-indigo-500 font-bold pl-1 border-l border-slate-200 dark:border-[#1f304a]">
                <FiAward className="w-3.5 h-3.5" /> {totalScore.toFixed(0)} pts
              </span>
            </div>

            <div className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-sm">
              {overallPercentage.toFixed(0)}%
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={e => {
                e.stopPropagation();
                onEdit(simulado);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-[#1f304a] transition-colors"
              title="Editar"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onDelete(simulado);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title="Excluir"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-[#1f304a] bg-slate-50/40 dark:bg-[#0f1929]/40">
          {simulado.subjects.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33]">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-[#1f304a]">
                <thead className="bg-slate-50 dark:bg-[#0f1929]">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Disciplina
                    </th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Peso
                    </th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
                      Acertos
                    </th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold text-rose-500 uppercase tracking-wider">
                      Erros
                    </th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="py-2.5 px-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-44">
                      Aproveitamento
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1f304a]/60">
                  {simulado.subjects.map((subject, index) => {
                    const subjectTotal = subject.totalQuestions;
                    const subjectCorrect = subject.correct;
                    const subjectPercentage =
                      subjectTotal > 0 ? (subjectCorrect / subjectTotal) * 100 : 0;
                    const barColor = getPerformanceColor(subjectPercentage);

                    return (
                      <tr
                        key={index}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#17263f]/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subject.color || '#10b981' }}
                          />
                          {subject.name}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-slate-600 dark:text-slate-300">
                          {subject.weight}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-emerald-500 font-bold">
                          {subject.correct}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-rose-500 font-bold">
                          {subject.incorrect}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          {subject.totalQuestions}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-[#0b1320] rounded-full h-2 overflow-hidden">
                              <div
                                className={`${barColor} h-2 rounded-full`}
                                style={{ width: `${Math.min(100, subjectPercentage)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-9 text-right">
                              {subjectPercentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {simulado.comments && (
            <div className="mt-3 p-3.5 bg-white dark:bg-[#131f33] rounded-xl border border-slate-200 dark:border-[#1f304a] text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-800 dark:text-white block mb-1">
                Observações:
              </span>
              {simulado.comments}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
