'use client';

import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { useData } from '../context/DataContext';
import { Globe, Loader2, Download } from 'lucide-react';

const ImportGuideForm = () => {
  const { refreshPlans } = useData();
  const [guideUrl, setGuideUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideUrl) {
      showNotification('Por favor, insira uma URL válida do TEC Concursos.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/import-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guideUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ocorreu um erro desconhecido.');
      }

      showNotification(result.message || 'Guia importado com sucesso!', 'success');
      setGuideUrl('');
      await refreshPlans();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Falha na comunicação com o servidor.';
      showNotification(`Erro ao importar: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#131f33] p-5 rounded-2xl border border-slate-200/80 dark:border-[#1f304a] shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Importar Guia Público do TEC Concursos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cole o link de um guia de estudos do TEC para extrair matérias e tópicos automaticamente
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 max-w-xl gap-2.5">
          <input
            type="url"
            value={guideUrl}
            onChange={(e) => setGuideUrl(e.target.value)}
            placeholder="https://www.tecconcursos.com.br/guias/..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#243552] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Importar Guia
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImportGuideForm;
