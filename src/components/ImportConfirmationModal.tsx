'use client';

import React from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ImportConfirmationModal: React.FC<ImportConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1f304a] p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Confirmar Restauração
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          A importação deste arquivo substituirá <strong>TODOS</strong> os seus dados atuais pelos dados do backup selecionado. Deseja continuar?
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-200/70 dark:bg-[#1a2942] text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition-colors"
          >
            Restaurar Backup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportConfirmationModal;
