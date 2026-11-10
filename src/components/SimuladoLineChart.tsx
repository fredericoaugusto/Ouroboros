'use client';

import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SimuladoLineChartProps {
  labels: string[];
  performanceData: number[];
  scoreData: number[];
  chartType: 'desempenho' | 'pontuacao';
}

export default function SimuladoLineChart({
  labels,
  performanceData,
  scoreData,
  chartType,
}: SimuladoLineChartProps) {
  const isPerformance = chartType === 'desempenho';

  const data = {
    labels,
    datasets: [
      {
        label: isPerformance ? 'Desempenho (%)' : 'Pontuação Líquida',
        data: isPerformance ? performanceData : scoreData,
        borderColor: isPerformance ? '#10b981' : '#6366f1',
        backgroundColor: isPerformance
          ? 'rgba(16, 185, 129, 0.15)'
          : 'rgba(99, 102, 241, 0.15)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: isPerformance ? '#10b981' : '#6366f1',
        pointBorderColor: '#0b1320',
        pointBorderWidth: 2,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#1e293b',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.12)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return <Line data={data} options={options} />;
}
