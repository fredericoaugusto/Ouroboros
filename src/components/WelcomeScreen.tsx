'use client';

import React from 'react';
import { Plus, Compass } from 'lucide-react';

interface WelcomeScreenProps {
  onOpenModal?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenModal }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] p-8">
      <div className="max-w-md text-center bg-white dark:bg-[#131f33] rounded-2xl border border-slate-200 dark:border-[#1f304a] p-8 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-4">
          <Compass className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Comece seu Planejamento
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Organize sua rotina de estudos em ciclos inteligentes ou quadro semanal com sugestões automáticas de tópicos.
        </p>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
          >
            <Plus className="w-4 h-4" />
            Criar Planejamento de Estudos
          </button>
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;
