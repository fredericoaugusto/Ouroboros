'use client';

import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, TooltipItem } from 'chart.js';

const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart: Chart) {
    if (chart.config.options?.elements && (chart.config.options.elements as any).center) {
      const ctx = chart.ctx;
      const centerConfig = (chart.config.options.elements as any).center;
      const fontStyle = centerConfig.fontStyle || 'Plus Jakarta Sans, Inter, sans-serif';
      const txt = centerConfig.text;
      const color = centerConfig.color || '#10b981';

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
      const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

      ctx.font = `800 ${centerConfig.fontSize}px ${fontStyle}`;
      ctx.fillStyle = color;
      ctx.fillText(txt, centerX, centerY);
    }
  },
};

interface ChartComponentsProps {
  stats: {
    totalCorrectQuestions: number;
    totalQuestions: number;
    dailyStudyTime: Record<string, number>;
    totalStudyTime: number;
    uniqueStudyDays: number;
  };
}

const ChartComponents: React.FC<ChartComponentsProps> = ({ stats }) => {
  const [chartJsLoaded, setChartJsLoaded] = useState(false);

  useEffect(() => {
    setChartJsLoaded(true);
  }, []);

  const wrongQuestions = Math.max(0, stats.totalQuestions - stats.totalCorrectQuestions);
  const hasQuestions = stats.totalQuestions > 0;

  const doughnutData = {
    labels: ['Acertos', 'Erros'],
    datasets: [
      {
        data: hasQuestions ? [stats.totalCorrectQuestions, wrongQuestions] : [1, 0],
        backgroundColor: hasQuestions
          ? ['#10b981', '#f43f5e']
          : ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0.05)'],
        borderWidth: 0,
        cutout: '74%',
      },
    ],
  };

  const correctPercentage = hasQuestions
    ? ((stats.totalCorrectQuestions / stats.totalQuestions) * 100).toFixed(1)
    : '0.0';

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: hasQuestions,
        callbacks: {
          label: function (context: TooltipItem<'doughnut'>) {
            return `${context.label || ''}: ${context.parsed ?? 0}`;
          },
        },
      },
    },
    elements: {
      center: {
        text: `${correctPercentage}%`,
        color: '#10b981',
        fontStyle: 'Plus Jakarta Sans, Inter, sans-serif',
        fontSize: 28,
      },
    },
  };

  if (!chartJsLoaded) {
    return <div className="h-48 flex items-center justify-center text-xs text-slate-400">Carregando...</div>;
  }

  return (
    <div className="w-full h-56 flex items-center justify-center relative">
      <Doughnut data={doughnutData} options={doughnutOptions} plugins={[centerTextPlugin]} />
    </div>
  );
};

export default ChartComponents;
