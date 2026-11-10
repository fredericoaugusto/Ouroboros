'use client';

import React from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-[#131f33] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1f304a] w-full max-w-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-slate-50/60 dark:bg-[#0f1929]/60 px-6 py-3.5 border-t border-slate-100 dark:border-[#1f304a] flex justify-end gap-2.5">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-[#1a2942] hover:bg-slate-300/70 transition-colors"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-sm transition-colors"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
