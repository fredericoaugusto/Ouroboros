'use client';

import React, { useState, useRef } from 'react';
import {
  FiDownload,
  FiUpload,
  FiAlertTriangle,
  FiLoader,
  FiDatabase,
  FiShield,
  FiTrash2,
} from 'react-icons/fi';
import { useData } from '../../context/DataContext';
import DeleteAllDataModal from '../../components/DeleteAllDataModal';
import ImportConfirmationModal from '../../components/ImportConfirmationModal';

const BackupPage = () => {
  const { exportAllData, importAllData, clearAllData } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const link = document.createElement('a');
      link.href = jsonString;
      const date = new Date().toISOString().split('T')[0];
      link.download = `backup-ouroboros-${date}.json`;
      link.click();
      setSuccess('Backup completo exportado com sucesso!');
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao exportar os dados.');
      setSuccess(null);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsImportModalOpen(true);
    }
  };

  const handleConfirmImport = () => {
    if (!selectedFile) return;

    setIsImportModalOpen(false);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Formato de arquivo inválido.');
        }
        const data = JSON.parse(text);
        await importAllData(data);

        setSuccess(
          'Dados importados com sucesso! A página será recarregada em instantes...'
        );
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      } catch (err: any) {
        console.error(err);
        setError(
          err.message ||
            'Ocorreu um erro ao importar o arquivo. Verifique se é um JSON válido.'
        );
        setSuccess(null);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(selectedFile);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearAllData = async () => {
    setIsDeleteModalOpen(false);
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await clearAllData();
      setSuccess('Todos os dados foram apagados com sucesso! Recarregando...');
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao apagar os dados.');
      setSuccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 pb-16">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Backup e Restauração
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Seus dados pertencem 100% a você. Exporte, restaure ou gerencie o armazenamento local.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl text-xs font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl text-xs font-semibold">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Export Card */}
          <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <FiDownload className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                Exportar Backup Completo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                Gera um arquivo <code className="text-emerald-500 font-mono">.json</code> contendo todos os seus planos de estudo, editais verticalizados, anotações do cockpit, scores, histórico e simulados.
              </p>
            </div>
            <button
              onClick={handleExport}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <FiDownload className="w-4 h-4" />
              Baixar Arquivo de Backup
            </button>
          </div>

          {/* Import Card */}
          <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                <FiUpload className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                Restaurar a partir de Arquivo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Restaure seus estudos a partir de um backup salvo anteriormente. Ideal para migrar de computador ou recuperar dados.
              </p>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 mb-4 flex items-start gap-2">
                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  A restauração substituirá os dados atuais pelos dados do arquivo selecionado.
                </span>
              </div>
            </div>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <FiLoader className="w-4 h-4 animate-spin" />
              ) : (
                <FiUpload className="w-4 h-4" />
              )}
              {isLoading ? 'Importando...' : 'Selecionar Arquivo JSON'}
            </button>
          </div>

          {/* Danger Zone: Reset */}
          <div className="md:col-span-2 bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-rose-500/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <FiTrash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Zerar Plataforma (Começar do Zero)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Remove permanentemente todos os planos, históricos, revisões e simulados da sua conta.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 font-bold text-xs transition-all shrink-0"
            >
              Apagar Todos os Dados
            </button>
          </div>
        </div>
      </div>

      <DeleteAllDataModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleClearAllData}
      />
      <ImportConfirmationModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
};

export default BackupPage;
