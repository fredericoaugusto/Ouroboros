'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiPercent,
  FiAward,
  FiTrash2,
  FiArrowLeft,
} from 'react-icons/fi';
import { useData } from '../context/DataContext';
import { SimuladoRecord } from '../app/actions';
import Breadcrumbs from './Breadcrumbs';

interface Subject {
  name: string;
  weight: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  color?: string;
}

interface AddSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSimulado?: SimuladoRecord | null;
}

export default function AddSimuladoModal({
  isOpen,
  onClose,
  initialSimulado,
}: AddSimuladoModalProps) {
  const { studyPlans, addSimuladoRecord, updateSimuladoRecord } = useData();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [examStyle, setExamStyle] = useState('Múltipla Escolha');
  const [simuladoName, setSimuladoName] = useState('');
  const [banca, setBanca] = useState('');
  const [timeSpent, setTimeSpent] = useState('04:00:00');
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialSimulado) {
        setSelectedDate(initialSimulado.date);
        setExamStyle(initialSimulado.style);
        setSimuladoName(initialSimulado.name);
        setBanca(initialSimulado.banca);
        setTimeSpent(initialSimulado.timeSpent);
        setComments(initialSimulado.comments);
        setSubjects(initialSimulado.subjects);
      } else {
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setExamStyle('Múltipla Escolha');
        setSimuladoName('');
        setBanca('');
        setTimeSpent('04:00:00');
        setComments('');
        if (studyPlans) {
          const subjectsMap = new Map<string, Subject>();
          studyPlans.forEach(plan => {
            plan.subjects?.forEach(subject => {
              if (!subjectsMap.has(subject.subject)) {
                subjectsMap.set(subject.subject, {
                  name: subject.subject,
                  weight: 1,
                  totalQuestions: 0,
                  correct: 0,
                  incorrect: 0,
                  color: subject.color || '#10b981',
                });
              }
            });
          });
          setSubjects(Array.from(subjectsMap.values()));
        }
      }
    }
  }, [isOpen, initialSimulado, studyPlans]);

  const handleSubjectChange = (index: number, field: keyof Subject, value: string) => {
    const newSubjects = [...subjects];
    const numericValue = parseInt(value, 10);
    if (typeof newSubjects[index][field] === 'number') {
      (newSubjects[index] as any)[field] = isNaN(numericValue) ? 0 : numericValue;
    }
    setSubjects(newSubjects);
  };

  const handleDeleteSubject = (indexToDelete: number) => {
    setSubjects(subjects.filter((_, index) => index !== indexToDelete));
  };

  const totals = useMemo(() => {
    return subjects.reduce(
      (acc, subject) => {
        acc.totalQuestions += subject.totalQuestions;
        acc.correct += subject.correct;
        acc.incorrect += subject.incorrect;
        const subjectPoints =
          examStyle === 'Certo/Errado'
            ? subject.correct - subject.incorrect
            : subject.correct * subject.weight;
        acc.points += subjectPoints;
        return acc;
      },
      { totalQuestions: 0, correct: 0, incorrect: 0, points: 0 }
    );
  }, [subjects, examStyle]);

  const totalBlank = totals.totalQuestions - totals.correct - totals.incorrect;
  const totalPercentage =
    totals.totalQuestions > 0
      ? Math.round((totals.correct / totals.totalQuestions) * 100)
      : 0;

  const handleSaveSimulado = async () => {
    const simuladoData = {
      date: selectedDate,
      name: simuladoName || 'Simulado Geral',
      style: examStyle,
      banca: banca || 'Geral',
      timeSpent: timeSpent,
      subjects: subjects.map(s => ({
        name: s.name,
        weight: s.weight,
        totalQuestions: s.totalQuestions,
        correct: s.correct,
        incorrect: s.incorrect,
        color: s.color || '#10b981',
      })),
      comments: comments,
    };

    try {
      if (initialSimulado) {
        await updateSimuladoRecord({ ...simuladoData, id: initialSimulado.id });
      } else {
        await addSimuladoRecord(simuladoData);
      }
      onClose();
    } catch (error) {
      console.error('Falha ao salvar simulado:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Simulados', onClick: onClose },
              { label: initialSimulado ? `Editar: ${initialSimulado.name}` : 'Registrar Novo Simulado' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1f304a] w-full flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-[#1f304a]">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {initialSimulado ? 'Editar Simulado' : 'Registrar Novo Simulado'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preencha seu desempenho por disciplina para calcular a nota líquida
              </p>
            </div>
          </header>

          {/* Body */}
          <main className="p-6 space-y-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nome do Simulado
              </label>
              <input
                type="text"
                placeholder="Ex: 1º Simulado Pós-Edital"
                value={simuladoName}
                onChange={e => setSimuladoName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Estilo de Prova
              </label>
              <select
                value={examStyle}
                onChange={e => setExamStyle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option>Múltipla Escolha</option>
                <option>Certo/Errado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Banca
              </label>
              <input
                type="text"
                placeholder="Ex: CEBRASPE, FGV"
                value={banca}
                onChange={e => setBanca(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Tempo Gasto
              </label>
              <input
                type="text"
                value={timeSpent}
                onChange={e => setTimeSpent(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Subjects Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1f304a]">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1f304a]">
              <thead className="bg-slate-50 dark:bg-[#0f1929]">
                <tr>
                  <th className="py-2.5 px-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Disciplina
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Peso
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Q.
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
                    Acertos
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-rose-500 uppercase tracking-wider">
                    Erros
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Brancos
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-indigo-500 uppercase tracking-wider">
                    Pontos
                  </th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
                    %
                  </th>
                  <th className="py-2.5 px-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1f304a]/60 bg-white dark:bg-[#131f33]">
                {subjects.map((subject, index) => {
                  const blankQuestions =
                    subject.totalQuestions - subject.correct - subject.incorrect;
                  const subjectPoints =
                    examStyle === 'Certo/Errado'
                      ? subject.correct - subject.incorrect
                      : subject.correct * subject.weight;
                  const percentage =
                    subject.totalQuestions > 0
                      ? Math.round((subject.correct / subject.totalQuestions) * 100)
                      : 0;

                  return (
                    <tr
                      key={subject.name}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#17263f]/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: subject.color || '#10b981' }}
                        />
                        {subject.name}
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          value={subject.weight}
                          onChange={e =>
                            handleSubjectChange(index, 'weight', e.target.value)
                          }
                          className="w-16 px-2 py-1 text-xs text-center bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          value={subject.totalQuestions}
                          onChange={e =>
                            handleSubjectChange(index, 'totalQuestions', e.target.value)
                          }
                          className="w-16 px-2 py-1 text-xs text-center bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          value={subject.correct}
                          onChange={e =>
                            handleSubjectChange(index, 'correct', e.target.value)
                          }
                          className="w-16 px-2 py-1 text-xs text-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          value={subject.incorrect}
                          onChange={e =>
                            handleSubjectChange(index, 'incorrect', e.target.value)
                          }
                          className="w-16 px-2 py-1 text-xs text-center bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20 rounded-lg"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs font-semibold text-slate-500">
                        {blankQuestions < 0 ? '0' : blankQuestions}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs font-bold text-indigo-500">
                        {subjectPoints}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs font-bold text-emerald-500">
                        {percentage}%
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleDeleteSubject(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-[#0f1929] font-bold text-xs text-slate-800 dark:text-slate-200">
                <tr>
                  <td colSpan={2} className="py-2.5 px-4 text-right uppercase">
                    Totais
                  </td>
                  <td className="py-2.5 px-3 text-center">{totals.totalQuestions}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">
                    {totals.correct}
                  </td>
                  <td className="py-2.5 px-3 text-center text-rose-500">
                    {totals.incorrect}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400">
                    {totalBlank < 0 ? '0' : totalBlank}
                  </td>
                  <td className="py-2.5 px-3 text-center text-indigo-500">
                    {totals.points}
                  </td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">
                    {totalPercentage}%
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Comentários e Diagnóstico Pós-Prova
            </label>
            <textarea
              placeholder="Anote os pontos que precisam de reforço, gestão de tempo ou matérias críticas..."
              rows={2}
              value={comments}
              onChange={e => setComments(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1f304a] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </main>

        {/* Footer */}
        <footer className="flex justify-end items-center gap-3 px-6 py-4 bg-slate-50/60 dark:bg-[#0f1929]/60 border-t border-slate-100 dark:border-[#1f304a]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-[#1a2942] rounded-xl hover:bg-slate-300/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveSimulado}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl shadow-sm transition-all"
          >
            Salvar Simulado
          </button>
        </footer>
        </div>
      </div>
    </div>
  );
}
