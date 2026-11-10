'use client';

import React, { useState } from 'react';
import { FiPlus, FiAward, FiCheckCircle, FiXCircle, FiMinusCircle, FiTrendingUp } from 'react-icons/fi';
import AddSimuladoModal from '../../components/AddSimuladoModal';
import SimuladoCard from '../../components/SimuladoCard';
import SimuladoLineChart from '../../components/SimuladoLineChart';
import { useData } from '../../context/DataContext';
import { SimuladoRecord } from '../../app/actions';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function SimuladosPage() {
  const { simuladoRecords, deleteSimuladoRecord } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSimulado, setEditingSimulado] = useState<SimuladoRecord | null>(null);
  const [chartType, setChartType] = useState<'desempenho' | 'pontuacao'>('desempenho');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [simuladoToDelete, setSimuladoToDelete] = useState<SimuladoRecord | null>(null);

  const realizadosCount = simuladoRecords.length;
  const latestSimulado =
    simuladoRecords.length > 0 ? simuladoRecords[simuladoRecords.length - 1] : null;

  const acertos = latestSimulado
    ? latestSimulado.subjects.reduce((sum, s) => sum + s.correct, 0)
    : 0;
  const totalQuestionsLastSimulado = latestSimulado
    ? latestSimulado.subjects.reduce((sum, s) => sum + s.totalQuestions, 0)
    : 0;
  const erros = latestSimulado
    ? latestSimulado.subjects.reduce((sum, s) => sum + s.incorrect, 0)
    : 0;
  const brancos = latestSimulado ? totalQuestionsLastSimulado - acertos - erros : 0;
  const percentual =
    totalQuestionsLastSimulado > 0
      ? Math.round((acertos / totalQuestionsLastSimulado) * 100)
      : 0;

  const formatDateForChartLabel = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const chartLabels = simuladoRecords.map(s => formatDateForChartLabel(s.date));
  const chartPerformanceData = simuladoRecords.map(s => {
    const totalQ = s.subjects.reduce((sum, sub) => sum + sub.totalQuestions, 0);
    const correctQ = s.subjects.reduce((sum, sub) => sum + sub.correct, 0);
    return totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
  });

  const chartScoreData = simuladoRecords.map(s => {
    let totalScore = 0;
    s.subjects.forEach(sub => {
      if (s.style === 'Certo/Errado') {
        totalScore += sub.correct - sub.incorrect;
      } else {
        totalScore += sub.correct * sub.weight;
      }
    });
    return totalScore;
  });

  const handleOpenModal = () => {
    setEditingSimulado(null);
    setIsModalOpen(true);
  };

  const handleEditSimulado = (simulado: SimuladoRecord) => {
    setEditingSimulado(simulado);
    setIsModalOpen(true);
  };

  const handleDeleteSimulado = (simulado: SimuladoRecord) => {
    setSimuladoToDelete(simulado);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (simuladoToDelete) {
      await deleteSimuladoRecord(simuladoToDelete.id);
      setSimuladoToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Simulados
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhe sua evolução em provas completas e simulados cronometrados
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-sm transition-all text-xs font-bold"
          >
            <FiPlus className="w-4 h-4 stroke-[2.5]" />
            Novo Simulado
          </button>
        </header>

        {/* Top Grid: KPIs + Evolution Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#131f33] p-5 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Simulados Realizados
                </span>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {realizadosCount}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FiAward className="w-5 h-5" />
              </div>
            </div>

            {latestSimulado ? (
              <div className="bg-white dark:bg-[#131f33] p-5 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Último Simulado
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[180px]">
                      {latestSimulado.name}
                    </h3>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold text-lg">
                    {percentual}%
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-[#1f304a]">
                  <div className="bg-slate-50 dark:bg-[#0f1929] p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 uppercase block">Acertos</span>
                    <span className="text-sm font-bold text-emerald-500">{acertos}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0f1929] p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 uppercase block">Erros</span>
                    <span className="text-sm font-bold text-rose-500">{erros}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#0f1929] p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 uppercase block">Brancos</span>
                    <span className="text-sm font-bold text-slate-400">{brancos}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#131f33] p-5 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex-1 flex items-center justify-center text-center">
                <p className="text-xs text-slate-400">
                  As métricas do seu último simulado aparecerão aqui.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-[#131f33] p-5 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                  Evolução nos Simulados
                </h2>
              </div>
              {simuladoRecords.length > 0 && (
                <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-[#0f1929] border border-slate-200 dark:border-[#1f304a]">
                  <button
                    onClick={() => setChartType('desempenho')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      chartType === 'desempenho'
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Desempenho (%)
                  </button>
                  <button
                    onClick={() => setChartType('pontuacao')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      chartType === 'pontuacao'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Pontuação Líquida
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-[240px] flex items-center justify-center bg-slate-50/50 dark:bg-[#0f1929]/50 rounded-xl p-4 border border-slate-100 dark:border-[#1f304a]/60">
              {simuladoRecords.length > 0 ? (
                <div className="w-full h-[230px]">
                  <SimuladoLineChart
                    labels={chartLabels}
                    performanceData={chartPerformanceData}
                    scoreData={chartScoreData}
                    chartType={chartType}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Registre simulados para visualizar o gráfico de evolução.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Simulados List */}
        {realizadosCount > 0 ? (
          <div className="space-y-3">
            {simuladoRecords.map(simulado => (
              <SimuladoCard
                key={simulado.id}
                simulado={simulado}
                onEdit={handleEditSimulado}
                onDelete={handleDeleteSimulado}
              />
            ))}
          </div>
        ) : (
          <div className="text-center bg-white dark:bg-[#131f33] p-12 rounded-2xl shadow-sm border border-slate-200 dark:border-[#1f304a]">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <FiAward className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              Você ainda não registrou nenhum simulado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Cadastre seus simulados para acompanhar sua pontuação líquida e evolução por disciplina.
            </p>
            <button
              onClick={handleOpenModal}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-2"
            >
              <FiPlus className="w-4 h-4 stroke-[2.5]" />
              Registrar Primeiro Simulado
            </button>
          </div>
        )}
      </div>

      <AddSimuladoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialSimulado={editingSimulado}
      />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o simulado "${simuladoToDelete?.name}"? Esta ação é irreversível.`}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  );
}
