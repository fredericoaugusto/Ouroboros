'use client';

import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, Check, X, Trash2, Sparkles } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface UserAiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function UserAiKeyModal({ isOpen, onClose, onSaved }: UserAiKeyModalProps) {
  const { showNotification } = useNotification();
  const [deepseekInput, setDeepseekInput] = useState('');
  const [geminiInput, setGeminiInput] = useState('');
  const [maskedDeepseek, setMaskedDeepseek] = useState<string | null>(null);
  const [maskedGemini, setMaskedGemini] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/keys');
      if (res.ok) {
        const data = await res.json();
        setMaskedDeepseek(data.maskedDeepseekKey || null);
        setMaskedGemini(data.maskedGeminiKey || null);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      setDeepseekInput('');
      setGeminiInput('');
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deepseekInput.trim() && !geminiInput.trim()) {
      showNotification('Digite uma nova chave para salvar.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (deepseekInput.trim()) payload.deepseekKey = deepseekInput.trim();
      if (geminiInput.trim()) payload.geminiKey = geminiInput.trim();

      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(data.error || 'Erro ao salvar chave.', 'error');
      } else {
        setMaskedDeepseek(data.maskedDeepseekKey || null);
        setMaskedGemini(data.maskedGeminiKey || null);
        setDeepseekInput('');
        setGeminiInput('');
        showNotification(
          'Sua chave de API foi criptografada (AES-256-GCM) e salva com segurança na sua conta!',
          'success'
        );
        if (onSaved) onSaved();
      }
    } catch {
      showNotification('Falha ao conectar com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = async (provider: 'deepseek' | 'gemini') => {
    setSaving(true);
    try {
      const payload =
        provider === 'deepseek' ? { deepseekKey: '' } : { geminiKey: '' };
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMaskedDeepseek(data.maskedDeepseekKey || null);
        setMaskedGemini(data.maskedGeminiKey || null);
        showNotification('Chave removida da sua conta.', 'success');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <KeyRound size={20} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 block">
                Cofre Individual por Usuário • AES-256-GCM
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Configurar Minha Chave de API (IA)
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
          <ShieldCheck size={17} className="text-emerald-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Proteção Máxima:</strong> Sua chave é enviada diretamente ao servidor, <strong>criptografada com AES-256-GCM</strong> e vinculada somente ao seu usuário no banco de dados. Ela <strong>nunca</strong> volta para o navegador.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* DeepSeek Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100">
                1. Chave da API DeepSeek (<code>sk-...</code>)
              </label>
              {maskedDeepseek ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-extrabold">
                  <Check size={11} /> Salva: {maskedDeepseek}
                  <button
                    type="button"
                    onClick={() => handleRemoveKey('deepseek')}
                    className="ml-1 text-rose-400 hover:text-rose-500"
                    title="Remover chave"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  {loading ? 'Verificando...' : 'Nenhuma chave salva'}
                </span>
              )}
            </div>
            <input
              type="password"
              value={deepseekInput}
              onChange={(e) => setDeepseekInput(e.target.value)}
              placeholder={
                maskedDeepseek
                  ? 'Digite uma nova chave sk-... se quiser substituir a atual'
                  : 'Cole aqui sua chave sk-... da DeepSeek'
              }
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Optional Gemini Key */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#1f304a]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100">
                2. Opcional: Chave Google Gemini Gratuita (<code>AIza...</code>)
              </label>
              {maskedGemini ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-extrabold">
                  <Check size={11} /> Salva: {maskedGemini}
                  <button
                    type="button"
                    onClick={() => handleRemoveKey('gemini')}
                    className="ml-1 text-rose-400 hover:text-rose-500"
                    title="Remover chave"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Opcional (100% gratuita)</span>
              )}
            </div>
            <input
              type="password"
              value={geminiInput}
              onChange={(e) => setGeminiInput(e.target.value)}
              placeholder="Opcional: Chave gratuita do Google AI Studio (aistudio.google.com/apikey)"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2942]"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={saving || (!deepseekInput.trim() && !geminiInput.trim())}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 shadow-sm transition-all"
            >
              <Sparkles size={14} />
              {saving ? 'Criptografando e Salvando...' : 'Salvar Chave Criptografada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
