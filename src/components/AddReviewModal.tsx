'use client';

import React, { useState } from 'react';
import { Calendar, X, Check } from 'lucide-react';

interface AddReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (days: number) => void;
}

const AddReviewModal: React.FC<AddReviewModalProps> = ({ isOpen, onClose, onSave }) => {
  const [days, setDays] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleSave = () => {
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays <= 0) {
      setError('Insira um número válido de dias (maior que 0).');
      return;
    }
    onSave(numDays);
    setDays('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setDays('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
      <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1f304a]">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Adicionar Revisão
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label
              htmlFor="review-days"
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Quantos dias para a próxima revisão?
            </label>
            <input
              type="number"
              id="review-days"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Ex: 7"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
          </div>

          <div className="flex justify-end items-center gap-2.5 pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddReviewModal;
