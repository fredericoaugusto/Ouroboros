'use client';

import React from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const CATEGORY_MAP: { [key: string]: string } = {
  teoria: 'Teoria',
  revisao: 'Revisão',
  questoes: 'Questões',
  leitura_lei: 'Lei Seca',
  jurisprudencia: 'Jurisprudência',
};

interface CategoryHoursChartProps {
  categoryStudyHours: Record<string, number>;
}

const formatTimeLabel = (value: number): string => {
  const hours = Math.floor(value);
  const minutes = Math.round((value % 1) * 60);
  if (minutes > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}min`;
  }
  return `${hours}h`;
};

const CategoryHoursChart: React.FC<CategoryHoursChartProps> = ({ categoryStudyHours }) => {
  const orderedCategories = ['teoria', 'revisao', 'questoes', 'leitura_lei', 'jurisprudencia'];

  const chartData = {
    labels: orderedCategories.map((key) => CATEGORY_MAP[key] || key),
    datasets: [
      {
        label: 'Horas por Categoria',
        data: orderedCategories.map((key) => categoryStudyHours?.[key] || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
        fill: true,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: 'rgba(148, 163, 184, 0.2)' },
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        suggestedMin: 0,
        ticks: { display: false },
        pointLabels: {
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatTimeLabel(context.raw as number),
        },
      },
    },
  };

  return (
    <div className="w-full h-72">
      <Radar data={chartData} options={chartOptions} />
    </div>
  );
};

export default CategoryHoursChart;
