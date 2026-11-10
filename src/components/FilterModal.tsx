'use client';

import React, { useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../app/datepicker-custom.css';
import { FiX, FiFilter, FiRotateCcw, FiCheck, FiArrowLeft } from 'react-icons/fi';
import MultiSelectDropdown from './MultiSelectDropdown';
import Breadcrumbs from './Breadcrumbs';

interface EditalTopic {
  topic_text: string;
}

interface EditalSubject {
  subject: string;
  topics: EditalTopic[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (filters: any) => void;
  onApplyFilters?: (filters: any) => void;
  initialFilters?: any;
  sessions?: any[];
  availableCategories?: string[];
  availableSubjects?: string[];
  availableEditalData?: EditalSubject[];
}

const categoryLabels: { [key: string]: string } = {
  Teoria: 'Teoria',
  teoria: 'Teoria',
  Revisão: 'Revisão',
  revisao: 'Revisão',
  Exercícios: 'Exercícios',
  Simulado: 'Simulado',
  'Leitura de Lei': 'Leitura de Lei',
  leitura_lei: 'Leitura de Lei',
  Jurisprudência: 'Jurisprudência',
  jurisprudencia: 'Jurisprudência',
  Questões: 'Questões',
  questoes: 'Questões',
};

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  onApply,
  onApplyFilters,
  availableCategories = ['teoria', 'revisao', 'questoes', 'leitura_lei', 'jurisprudencia'],
  availableSubjects = [],
  availableEditalData = [],
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [minDuration, setMinDuration] = useState<string>('');
  const [maxDuration, setMaxDuration] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [minPerformance, setMinPerformance] = useState('');
  const [maxPerformance, setMaxPerformance] = useState('');

  const topicsForSelectedSubject = useMemo(() => {
    if (selectedSubjects.length === 0 || !availableEditalData) {
      return [];
    }
    const topics = availableEditalData
      .filter((subjectData: EditalSubject) => selectedSubjects.includes(subjectData.subject))
      .flatMap((subjectData: EditalSubject) =>
        (subjectData.topics || []).map(
          (topic: EditalTopic) => `${subjectData.subject} - ${topic.topic_text}`
        )
      );
    return [...new Set(topics)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [availableEditalData, selectedSubjects]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const triggerApply = (payload: any) => {
    if (onApply) onApply(payload);
    if (onApplyFilters) onApplyFilters(payload);
  };

  const handleApply = () => {
    triggerApply({
      startDate,
      endDate,
      minDuration: minDuration ? Number(minDuration) : undefined,
      maxDuration: maxDuration ? Number(maxDuration) : undefined,
      categories: selectedCategories,
      category: selectedCategories[0] || '',
      subjects: selectedSubjects,
      subject: selectedSubjects[0] || '',
      topics: selectedTopics,
      minPerformance: minPerformance ? Number(minPerformance) : undefined,
      maxPerformance: maxPerformance ? Number(maxPerformance) : undefined,
    });
    onClose();
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setMinDuration('');
    setMaxDuration('');
    setSelectedCategories([]);
    setSelectedSubjects([]);
    setSelectedTopics([]);
    setMinPerformance('');
    setMaxPerformance('');
    triggerApply({
      subject: '',
      category: '',
      startDate: '',
      endDate: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 bg-[#f8fafc] dark:bg-[#0b1320] z-30 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Histórico & Estatísticas', onClick: onClose },
              { label: 'Filtros Avançados' },
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
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-[#1f304a]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FiFilter className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Filtros Avançados
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Refine a visualização do seu histórico e estatísticas
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Período */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Período
              </label>
              <div className="space-y-2">
                <DatePicker
                  selected={startDate}
                  onChange={(date: Date | null) => setStartDate(date)}
                  selectsStart
                  startDate={startDate || undefined}
                  endDate={endDate || undefined}
                  placeholderText="Data inicial"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dateFormat="dd/MM/yyyy"
                  wrapperClassName="w-full"
                />
                <DatePicker
                  selected={endDate}
                  onChange={(date: Date | null) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate || undefined}
                  endDate={endDate || undefined}
                  minDate={startDate || undefined}
                  placeholderText="Data final"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dateFormat="dd/MM/yyyy"
                  wrapperClassName="w-full"
                />
              </div>
            </div>

            {/* Duração */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Duração (min)
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Mínimo (min)"
                  value={minDuration}
                  onChange={e => setMinDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Máximo (min)"
                  value={maxDuration}
                  onChange={e => setMaxDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Desempenho */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Desempenho (%)
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Mínimo (%)"
                  value={minPerformance}
                  onChange={e => setMinPerformance(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Máximo (%)"
                  value={maxPerformance}
                  onChange={e => setMaxPerformance(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Categoria */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Categoria de Estudo
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm'
                        : 'bg-white dark:bg-[#131f33] border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-300 hover:border-emerald-500/40'
                    }`}
                  >
                    {categoryLabels[category] || category}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Disciplina e Tópico */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Disciplina e Tópico
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Disciplina
                </span>
                <MultiSelectDropdown
                  options={availableSubjects}
                  selectedOptions={selectedSubjects}
                  onChange={setSelectedSubjects}
                  placeholder="Todas as disciplinas"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Tópico
                </span>
                <MultiSelectDropdown
                  options={topicsForSelectedSubject}
                  selectedOptions={selectedTopics}
                  onChange={setSelectedTopics}
                  placeholder="Todos os tópicos"
                  disabled={selectedSubjects.length === 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1f304a] bg-slate-50/50 dark:bg-[#0f1929]/50">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-[#1a2942] hover:bg-slate-300/70 transition-colors"
          >
            <FiRotateCcw className="w-3.5 h-3.5" />
            Limpar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 shadow-sm transition-all"
          >
            <FiCheck className="w-4 h-4" />
            Aplicar Filtros
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
