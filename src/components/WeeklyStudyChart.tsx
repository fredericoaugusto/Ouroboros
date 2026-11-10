'use client';

import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';

const WeeklyStudyChart = ({ dailyStudyHours, dailyQuestionStats }: any) => {
  const [viewMode, setViewMode] = useState<'time' | 'questions'>('time');

  if (!dailyStudyHours || !dailyQuestionStats) {
    return (
      <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 flex items-center justify-center h-64">
        <p className="text-xs text-slate-400">Carregando dados semanais...</p>
      </div>
    );
  }

  const processChartData = (dailyData: any, dataKey: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - dayOfWeek);
    firstDayOfWeek.setHours(0, 0, 0, 0);

    const weeklyData = Array(7).fill(0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(firstDayOfWeek);
      date.setDate(firstDayOfWeek.getDate() + i);
      const dateString = date.toISOString().split('T')[0];

      if (dailyData && dailyData[dateString]) {
        if (dataKey === 'hours') {
          weeklyData[i] = parseFloat((dailyData[dateString] || 0).toFixed(1));
        } else if (dataKey === 'total') {
          weeklyData[i] = dailyData[dateString].total || 0;
        }
      }
    }
    return weeklyData;
  };

  const timeData = {
    labels: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
    datasets: [
      {
        label: 'Horas de Estudo',
        data: processChartData(dailyStudyHours, 'hours'),
        backgroundColor: '#10b981',
        borderRadius: 6,
        barThickness: 18,
      },
    ],
  };

  const questionsData = {
    labels: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
    datasets: [
      {
        label: 'Questões Resolvidas',
        data: processChartData(dailyQuestionStats, 'total'),
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 18,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#94a3b8',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context: any) {
            if (context.parsed.y !== null) {
              return viewMode === 'time' ? `${context.parsed.y.toFixed(1)}h estudadas` : `${context.parsed.y} questões`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11, weight: '600' } },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: function (value: any) {
            return viewMode === 'time' ? `${value}h` : value;
          },
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Rendimento na Semana
          </h2>
        </div>
        <div className="flex bg-slate-100 dark:bg-[#0c1421] p-1 rounded-xl border border-slate-200 dark:border-[#1f304a]">
          <button
            onClick={() => setViewMode('time')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'time'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tempo
          </button>
          <button
            onClick={() => setViewMode('questions')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
              viewMode === 'questions'
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Questões
          </button>
        </div>
      </div>
      <div className="relative h-52">
        <Bar data={viewMode === 'time' ? timeData : questionsData} options={options} />
      </div>
    </div>
  );
};

export default WeeklyStudyChart;
