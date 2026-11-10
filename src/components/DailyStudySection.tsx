'use client';

import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Clock } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

const formatMinutesToHoursMinutes = (totalMinutes: number) => {
  if (totalMinutes <= 0) return '0min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}min` : `${minutes}min`;
};

const DailyStudySection = ({ dailySubjectStudyTime, subjectColors }: any) => {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    setCurrentDate(`${day}/${month}`);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todaysStudyData = dailySubjectStudyTime && dailySubjectStudyTime[today] ? dailySubjectStudyTime[today] : {};

  const subjectColorMap = (subjectColors || []).reduce((acc: any, subject: any) => {
    acc[subject.subject] = subject.color;
    return acc;
  }, {});

  const studyData = Object.entries(todaysStudyData).map(([subject, time]: any) => ({
    subject,
    minutes: Math.round(time / 60000),
    color: subjectColorMap[subject] || '#10b981',
  }));

  const totalStudyMinutes = studyData.reduce((acc, item) => acc + item.minutes, 0);

  const data = {
    labels: studyData.map((item) => item.subject),
    datasets: [
      {
        data: studyData.map((item) => item.minutes),
        backgroundColor: studyData.map((item) => item.color),
        borderColor: 'transparent',
        borderWidth: 0,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${formatMinutesToHoursMinutes(value)}`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Estudos de Hoje ({currentDate})
          </h2>
        </div>
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {formatMinutesToHoursMinutes(totalStudyMinutes)}
        </span>
      </div>

      {studyData.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-100 dark:border-[#1a293e]">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum estudo registrado hoje ainda.
          </p>
        </div>
      ) : (
        <>
          <div className="relative h-40 my-2">
            <Pie data={data} options={options} />
          </div>
          <ul className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-[#1a293e]">
            {studyData.map((item, index) => (
              <li key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 dark:text-slate-300 truncate">{item.subject}</span>
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">
                  {formatMinutesToHoursMinutes(item.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default DailyStudySection;
