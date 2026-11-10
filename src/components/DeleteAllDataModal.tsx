'use client';

import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface DeleteAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteAllDataModal: React.FC<DeleteAllDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [inputValue, setInputValue] = useState('');
  const isConfirmationTextMatched = inputValue === 'APAGAR TUDO';

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1f304a] p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Ação Irreversível
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          Tem certeza absoluta que deseja apagar <strong>TODOS</strong> os seus dados? Esta ação não pode ser desfeita.
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
          Digite <strong className="text-rose-500 font-mono">APAGAR TUDO</strong> abaixo para confirmar:
        </p>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="APAGAR TUDO"
          className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-[#1f304a] rounded-xl bg-slate-50 dark:bg-[#0f1929] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
        />

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-200/70 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmationTextMatched}
            className="px-4 py-2 text-xs font-bold bg-rose-500 text-white rounded-xl hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Apagar Tudo
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAllDataModal;
