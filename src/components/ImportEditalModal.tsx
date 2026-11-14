'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { getStandardAIPrompt, parseEditalText, ParsedSubject } from '../lib/editalParser';
import { importEditalMutationAction } from '../app/actions';
import { useData } from '../context/DataContext';
import { useNotification } from '../context/NotificationContext';
import Breadcrumbs from './Breadcrumbs';
import UserAiKeyModal from './UserAiKeyModal';
import { Copy, Check, Sparkles, FileText, ArrowRight, ArrowLeft, FolderPlus, Layers, KeyRound } from 'lucide-react';

interface ImportEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ImportEditalModal({ isOpen, onClose, onSuccess }: ImportEditalModalProps) {
  const { selectedDataFile, setSelectedDataFile, availablePlans, studyPlans, refreshPlans } = useData();
  const { showNotification } = useNotification();

  const [mode, setMode] = useState<'new' | 'append'>('new');
  const [aiSourceMode, setAiSourceMode] = useState<'prompt' | 'deepseek'>('prompt');
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState(false);
  const [unformattedEditalText, setUnformattedEditalText] = useState('');
  const [isGeneratingWithAI, setIsGeneratingWithAI] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [cargo, setCargo] = useState('');
  const [copied, setCopied] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('new');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('krono_deepseek_api_key');
      }
    }
  }, [isOpen]);

  const handleGenerateWithDeepSeek = async () => {
    if (!unformattedEditalText.trim()) {
      showNotification('Cole o conteúdo bruto do edital para a IA estruturar.', 'error');
      return;
    }
    setIsGeneratingWithAI(true);
    try {
      const res = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: getStandardAIPrompt(),
          userPrompt: `Estruture e verticalize o seguinte conteúdo programático de edital seguindo estritamente o formato solicitado:\n\n${unformattedEditalText}`,
          temperature: 0.1,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showNotification(data.error || 'Falha ao consultar DeepSeek IA.', 'error');
      } else if (data.content) {
        setRawText(data.content.replace(/```markdown|```/g, '').trim());
        showNotification(
          'Edital verticalizado pelo DeepSeek com sucesso! Confira o preview abaixo e clique em Confirmar e Importar.',
          'success'
        );
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro de conexão com a API do DeepSeek.', 'error');
    } finally {
      setIsGeneratingWithAI(false);
    }
  };

  const currentPlanName = useMemo(() => {
    if (!selectedDataFile) return '';
    const idx = availablePlans.indexOf(selectedDataFile);
    return idx !== -1 && studyPlans[idx]?.name ? studyPlans[idx].name : selectedDataFile.replace('.json', '');
  }, [selectedDataFile, availablePlans, studyPlans]);

  const parsedSubjects = useMemo<ParsedSubject[]>(() => {
    if (!rawText.trim()) return [];
    return parseEditalText(rawText);
  }, [rawText]);

  const totalTopicsCount = useMemo(() => {
    return parsedSubjects.reduce((acc, sub) => {
      const countSubTopics = (topics: any[]): number => {
        return topics.reduce((sAcc, t) => sAcc + 1 + (t.sub_topics ? countSubTopics(t.sub_topics) : 0), 0);
      };
      return acc + countSubTopics(sub.topics);
    }, 0);
  }, [parsedSubjects]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(getStandardAIPrompt());
      setCopied(true);
      showNotification('Prompt copiado! Cole na sua IA junto com o edital.', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showNotification('Não foi possível copiar automaticamente.', 'error');
    }
  };

  const handleImport = async () => {
    if (parsedSubjects.length === 0) {
      showNotification('Nenhuma disciplina ou tópico identificado no texto colado.', 'warning');
      return;
    }

    if (mode === 'new' && !newPlanName.trim()) {
      showNotification('Informe um nome para o novo plano (ex: PRF 2026).', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await importEditalMutationAction({
        mode: selectedDataFile ? mode : 'new',
        targetPlanFile: selectedDataFile,
        newPlanName: newPlanName.trim() || 'Plano Importado',
        cargo: cargo.trim(),
        subjects: parsedSubjects,
      });

      if (result.success && result.fileName) {
        if (refreshPlans) await refreshPlans();
        setSelectedDataFile(result.fileName);
        showNotification(
          `Edital importado com sucesso! ${parsedSubjects.length} disciplinas e ${totalTopicsCount} tópicos cadastrados.`,
          'success'
        );
        setRawText('');
        setNewPlanName('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showNotification(result.error || 'Erro ao importar o edital.', 'error');
      }
    } catch (error) {
      console.error('Erro ao importar edital:', error);
      showNotification('Falha ao salvar o edital importado.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 lg:left-64 bottom-14 z-30 bg-[#f8fafc] dark:bg-[#0b1320] overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Breadcrumbs
            items={[
              { label: 'Planos & Editais', onClick: onClose },
              { label: 'Importar Edital ou Disciplinas via IA' },
            ]}
            className="mb-0"
          />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#131f33] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>

        <div className="bg-white dark:bg-[#131f33] w-full rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1a293e]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Importar Edital ou Disciplinas via IA
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Crie um plano completo ou adicione disciplinas com tópicos e subtópicos
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
          
          {/* Destino da Importação */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Onde deseja importar?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  mode === 'new' || !selectedDataFile
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-[#0c1421] border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-400'
                }`}
              >
                <FolderPlus size={18} className="flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold block">Criar Novo Plano (Padrão)</span>
                  <span className="text-[11px] opacity-80 block">Gera um novo plano com este edital</span>
                </div>
              </button>
              {selectedDataFile && (
                <button
                  type="button"
                  onClick={() => setMode('append')}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    mode === 'append'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-[#0c1421] border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers size={18} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">Adicionar ao Plano Atual</span>
                    <span className="text-[11px] opacity-80 block truncate">Plano: {currentPlanName}</span>
                  </div>
                </button>
              )}
            </div>

            {(mode === 'new' || !selectedDataFile) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                    Nome do Plano *
                  </label>
                  <input
                    type="text"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="Ex: Tribunais 2.0, PRF, PC-RN..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                    Cargo / Concurso (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Policial Rodoviário Federal"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Escolha do Método: Copiar Prompt Externo vs. DeepSeek Integrado */}
          <div className="space-y-3">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a]">
              <button
                type="button"
                onClick={() => setAiSourceMode('prompt')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  aiSourceMode === 'prompt'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📋 Copiar Prompt (Qualquer IA Gratuita)
              </button>
              <button
                type="button"
                onClick={() => setAiSourceMode('deepseek')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  aiSourceMode === 'deepseek'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ⚡ DeepSeek IA Integrado (Automático)
              </button>
            </div>

            {aiSourceMode === 'prompt' ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1a293e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <FileText size={14} /> Passo 1: Copie o prompt padrão
                  </span>
                  <button
                    onClick={handleCopyPrompt}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Prompt Copiado!' : 'Copiar Prompt para IA'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Envie esse prompt para o <strong>ChatGPT, Claude, DeepSeek ou Gemini</strong> junto com o texto do seu edital. Depois basta dar{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
                    Ctrl+V
                  </kbd>{' '}
                  no campo de confirmação abaixo.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-indigo-500/[0.05] border border-indigo-500/25 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Sparkles size={14} /> Verticalização Direta via DeepSeek API (Chave Criptografada no Banco)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAiKeyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-500 text-xs font-bold transition-colors"
                  >
                    <KeyRound size={13} />
                    Configurar Minha Chave de IA
                  </button>
                </div>
                <textarea
                  value={unformattedEditalText}
                  onChange={(e) => setUnformattedEditalText(e.target.value)}
                  placeholder="Cole aqui o texto bruto do edital (do jeito que copiou do PDF do concurso)..."
                  rows={4}
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateWithDeepSeek}
                    disabled={isGeneratingWithAI}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all shadow-sm"
                  >
                    <Sparkles size={14} />
                    {isGeneratingWithAI
                      ? 'Verticalizando com DeepSeek (aguarde ~15s)...'
                      : '⚡ Verticalizar Edital com DeepSeek'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Passo 2: Colar Resposta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Passo 2: Cole o edital ou disciplina formatada
              </label>
              {parsedSubjects.length > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {parsedSubjects.length} disciplinas • {totalTopicsCount} tópicos detectados
                </span>
              )}
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`# DIREITO ADMINISTRATIVO\n- 1. Estado, governo e administração pública\n  - 1.1 Conceitos, elementos, poderes e organização\n  - 1.2 Natureza, fins e princípios\n- 2. Atos administrativos\n\n# DIREITO CONSTITUCIONAL\n- 1. Direitos e garantias fundamentais`}
              rows={7}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1a293e] text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Preview Rápido */}
          {parsedSubjects.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Disciplinas prontas para importar:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {parsedSubjects.map((sub, i) => (
                  <span
                    key={i}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-[#131f33] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#1f304a] flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                    {sub.subject} <span className="text-slate-400 font-normal">({sub.topics.length})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#1a293e] bg-slate-50/50 dark:bg-[#0c1421]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={parsedSubjects.length === 0 || isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isSubmitting ? 'Importando...' : 'Confirmar e Importar'}
            <ArrowRight size={14} />
          </button>
        </div>
        </div>
      </div>

      <UserAiKeyModal
        isOpen={isAiKeyModalOpen}
        onClose={() => setIsAiKeyModalOpen(false)}
      />
    </div>
  );
}
