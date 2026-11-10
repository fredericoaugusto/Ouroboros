'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { FolderKanban, ChevronUp, Check } from 'lucide-react';

export default function PlanSelector() {
  const { selectedDataFile, setSelectedDataFile, availablePlans } = useData();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatPlanLabel = (fileName: string) => {
    return fileName
      .replace('.json', '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#152238] border border-slate-200 dark:border-[#243552] hover:border-emerald-500/50 text-slate-800 dark:text-slate-100 transition-all text-xs font-semibold shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
            <FolderKanban className="w-3.5 h-3.5" />
          </div>
          <div className="text-left truncate">
            <div className="text-[10px] font-medium text-slate-400 leading-none mb-0.5">
              Plano Ativo
            </div>
            <div className="truncate text-xs font-bold text-slate-800 dark:text-white">
              {selectedDataFile ? formatPlanLabel(selectedDataFile) : 'Selecione um Plano'}
            </div>
          </div>
        </div>
        <ChevronUp
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div className="absolute z-50 bottom-full mb-2 w-full bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] shadow-xl max-h-60 rounded-xl py-1.5 text-xs overflow-auto">
          {availablePlans.length === 0 ? (
            <div className="px-3 py-2.5 text-slate-400 text-center">
              Nenhum plano criado ainda
            </div>
          ) : (
            availablePlans.map((plan) => {
              const isSelected = plan === selectedDataFile;
              return (
                <button
                  key={plan}
                  type="button"
                  onClick={() => {
                    setSelectedDataFile(plan);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 text-emerald-500 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{formatPlanLabel(plan)}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
