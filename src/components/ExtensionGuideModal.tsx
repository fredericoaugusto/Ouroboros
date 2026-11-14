'use client';

import React, { useEffect, useState } from 'react';
import {
  Puzzle,
  Download,
  Copy,
  Check,
  X,
  ShieldCheck,
  KeyRound,
  Scissors,
  Highlighter,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
  FolderOpen,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface ExtensionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExtensionGuideModal({ isOpen, onClose }: ExtensionGuideModalProps) {
  const { showNotification } = useNotification();
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [pairingToken, setPairingToken] = useState('');
  const [username, setUsername] = useState('');
  const [plansCount, setPlansCount] = useState(0);
  const [loadingToken, setLoadingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkInstalled = () => {
      setIsExtensionInstalled(
        document.documentElement.getAttribute('data-krono-extension-installed') === 'true'
      );
    };
    checkInstalled();
    const onInstalled = () => checkInstalled();
    window.addEventListener('krono:extension-installed', onInstalled);
    return () => window.removeEventListener('krono:extension-installed', onInstalled);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingToken(true);
    fetch('/api/extension/context', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.connected) {
          setPairingToken(data.pairingToken || '');
          setUsername(data.username || '');
          setPlansCount(Array.isArray(data.plans) ? data.plans.length : 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingToken(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const copyText = async (text: string, which: 'token' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2200);
        showNotification('Token de pareamento copiado!', 'success');
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2200);
        showNotification('Endereço brave://extensions copiado!', 'success');
      }
    } catch {
      showNotification('Não foi possível copiar automaticamente.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-2xl overflow-hidden my-auto animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#131f33] border-b border-slate-200 dark:border-[#1f304a] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Puzzle size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Extensão Krono para Brave / Chrome
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  v1.0 • Estilo Bússola
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use QConcursos, Caveira, TEC ou Planalto direto em outra aba com cronômetro e notas sincronizadas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1f304a] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isExtensionInstalled
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isExtensionInstalled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isExtensionInstalled
                ? `Extensão detectada neste navegador! Pareada automaticamente com ${username || 'sua conta'} (${plansCount} plano(s)).`
                : 'Extensão ainda não detectada neste navegador. Baixe o pacote abaixo e carregue no Brave em 30 segundos.'}
            </div>
          </div>

          {/* Download Action + Quick Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/api/extension/download"
              download="krono-extension-v1.zip"
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Download size={16} />
              Baixar Extensão Krono (.zip)
            </a>

            <button
              type="button"
              onClick={() => copyText('brave://extensions', 'url')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#131f33] hover:bg-slate-200 dark:hover:bg-[#1a2942] border border-slate-200 dark:border-[#1f304a] text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
            >
              {copiedUrl ? <Check size={15} className="text-emerald-500" /> : <FolderOpen size={15} />}
              {copiedUrl ? 'Copiado! Cole na barra do Brave' : 'Copiar "brave://extensions"'}
            </button>
          </div>

          {/* Como Instalar em 4 Passos */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#131f33]/70 border border-slate-200 dark:border-[#1f304a] space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              📦 Como ativar no Brave ou Chrome (sem precisar de Store)
            </h3>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Clique em <strong>Baixar Extensão Krono (.zip)</strong> acima e extraia o arquivo{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#090f1a] text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                  krono-extension
                </code>{' '}
                (ou selecione direto a pasta{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#090f1a] font-mono text-[11px]">
                  Krono/public/krono-extension
                </code>
                ).
              </li>
              <li>
                Abra uma nova aba no Brave e digite{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#090f1a] text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                  brave://extensions
                </code>{' '}
                (no Chrome:{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#090f1a] font-mono text-[11px]">
                  chrome://extensions
                </code>
                ).
              </li>
              <li>
                No canto superior direito, ative a chavinha <strong>Modo do desenvolvedor</strong>.
              </li>
              <li>
                Clique em <strong>Carregar sem compactação</strong> e selecione a pasta{' '}
                <strong>krono-extension</strong>. Depois fixe o ícone do Krono no quebra-cabeça 🧩!
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111c2d] border border-slate-200 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Sites Monitorados Automaticamente & Como Fechar a Barra
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Por padrão, a barra flutuante abre automaticamente apenas em <strong>14 portais de estudo e legislação</strong>:{' '}
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                qconcursos.com, tecconcursos.com.br, caveira.com, planalto.gov.br, estrategiaconcursos.com.br, grancursosonline.com.br, aprovaconcursos.com.br, pciconcursos.com.br, jusbrasil.com.br, dizerodireito.com.br, stf.jus.br, stj.jus.br, senado.leg.br, camara.leg.br
              </span>
              .
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>Para fechar quando não quiser usar:</strong> clique no botão <strong>✕</strong> na barra flutuante (ou em <strong>Fechar Barra Aqui</strong> no ícone 🧩 da extensão). Para reabrir depois, clique no ícone 🧩 do Krono na barra do navegador.
              <br />• <strong>Para incluir ou bloquear sites:</strong> abra o popup da extensão (ícone 🧩) e clique em <strong>Sempre Auto Aqui</strong> / <strong>Não Abrir Aqui</strong>, ou alterne entre <em>Só Sites de Estudo</em>, <em>Todos os Sites</em> e <em>Apenas Manual</em>.
            </p>
          </div>

          {/* Forma A + Forma B Explanation + Token */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#090f1a] border border-slate-200 dark:border-[#1f304a] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  Pareamento Duplo Seguro (Forma A + Forma B)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <strong>Forma A (Automática):</strong> Com a aba do Krono aberta, a extensão lê ao vivo seu
                  cronômetro, disciplina e tópico ativo. <br />
                  <strong>Forma B (Token Restrito):</strong> Se você fechar a aba do Krono ou usar outro domínio,
                  cole este Token no popup da extensão. Ele dá acesso <strong>apenas</strong> para ler seus tópicos
                  do edital e salvar notas/prints — <strong>nunca expõe sua senha nem suas chaves de IA</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  value={loadingToken ? 'Gerando token seguro...' : pairingToken || 'Faça login para gerar'}
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  title={showToken ? 'Ocultar token' : 'Mostrar token'}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                disabled={!pairingToken}
                onClick={() => copyText(pairingToken, 'token')}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
              >
                {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                {copiedToken ? 'Copiado!' : 'Copiar Token'}
              </button>
            </div>
          </div>

          {/* What the Extension Gives You */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                <Clock size={14} /> Cronômetro & Tópico
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mostra o relógio ao vivo na barra flutuante e permite pausar ou trocar o tópico de destino ali mesmo.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                <Scissors size={14} /> Recorte (Alt + S)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Recorte qualquer questão, comentário ou tabela — inclusive com seus grifos em cima — direto para suas Notas.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                <Highlighter size={14} /> Grifo Reto & Seleção
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Marca-texto reto sem borrão na página e envio com 1 clique de qualquer texto selecionado com o mouse.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#090f1a] border-t border-slate-200 dark:border-[#1f304a] flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-500" />
            Todos os recortes entram formatados direto no editor rico das Notas do Tópico.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#1f304a] text-slate-700 dark:text-slate-200 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
