'use client';

import React from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Clock,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface ScoreTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScoreTutorialModal: React.FC<ScoreTutorialModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1a293e] bg-slate-50/50 dark:bg-[#0c1421]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Como funciona o Motor de Score & Revisões Inteligentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guia didático completo do algoritmo matemático do Alexandria
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo Explicativo */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {/* Bloco 1: Visão Geral */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-emerald-500" />
              1. Por que abandonar as revisões fixas (24h, 7d, 30d)?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              No modelo antigo de revisões fixas, um tópico fácil em que você acertou <strong>95% das questões</strong> e um tópico complexo em que você acertou <strong>40%</strong> voltavam no mesmo prazo (ex: 7 dias), gerando uma bola de neve impossível de cumprir. No <strong>Alexandria</strong>, o intervalo de revisão é elástico e calculado em tempo real pela sua performance prática, pela importância do assunto no edital e pela curva biológica de esquecimento.
            </p>
          </div>

          {/* Bloco 2: Como os dias de revisão são decididos na Sessão */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-indigo-500" />
              2. Tabela de Prazos da Revisão Inteligente (ao Registrar Estudo)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sempre que você registra um estudo com a opção <strong>Revisão inteligente pelo Score</strong> marcada, o sistema analisa sua taxa de acerto na bateria, o tamanho da amostra e quantas vezes você já estudou o tópico:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-rose-500 uppercase">
                    🔴 Crítico (&lt; 40% de acerto)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[11px] font-bold">
                    +3 dias
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Ex: acertou 0 de 2 ou 1 de 3. Indica lacuna teórica grave; o tópico volta rapidamente em 3 dias.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-amber-500 uppercase">
                    🟠 Alerta (40% a 55% de acerto)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[11px] font-bold">
                    +6 dias
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Ex: <strong>1 acerto e 1 erro (50%)</strong>. Exige reforço na semana seguinte para consolidar a base.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-amber-400 uppercase">
                    🟡 Em Construção (56% a 79%)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[11px] font-bold">
                    +11 a +16 dias
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Ex: 2/3 (67%) ou 3/4 (75%). Você já compreende o tema, mas precisa lapidar pegadinhas em ~2 semanas.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-emerald-500 uppercase">
                    🟢 Domínio Forte (80% a 88%)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold">
                    +20 a +25 dias
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Ex: <strong>5 acertos e 1 erro (83%)</strong>. Ótimo domínio! A janela se expande para mais de 3 semanas.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-emerald-400 uppercase">
                    💎 Consolidado / Avançado (≥ 89% de acerto)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[11px] font-bold">
                    +30 a +45 dias
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Quando você atinge ≥ 89% em uma bateria sólida de questões, o tópico entra em manutenção de longo prazo (30 a 45 dias). <em>Nota: se você fizer apenas 1 ou 2 questões e acertar 100%, o sistema aplica a Suavização de Laplace e agenda em ~19 dias até você ter uma amostragem maior.</em>
                </p>
              </div>
            </div>
          </div>

          {/* Bloco 3: Composição do Score e Decaimento Lambda */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders size={16} className="text-emerald-500" />
              3. Como o Score (0 a 100) e a Curva de Esquecimento (λ) são calculados?
            </h3>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0c1421] border border-slate-200 dark:border-[#1f304a] space-y-2.5 text-xs">
              <p>
                <strong>• Score Base (Domínio Real):</strong> Combina sua nota de <strong>Domínio Declarado (0 a 5)</strong> no Cockpit do Tópico com sua <strong>Taxa de Acerto em Questões</strong> suavizada por Laplace:
                <code className="block mt-1 px-2.5 py-1.5 rounded bg-slate-200/70 dark:bg-[#131f33] text-emerald-600 dark:text-emerald-400 font-mono">
                  Taxa Ajustada = (Acertos + 2) / (Total + 4) × 100
                </code>
                À medida que você resolve mais questões, o peso da sua opinião subjetiva diminui (caindo para 15%) e o peso das questões sobe para <strong>85%</strong>.
              </p>
              <p>
                <strong>• Decaimento Temporal (λ - Curva de Ebbinghaus):</strong> Todo dia sem estudar o tópico reduz um pouco o seu Score Atual segundo a equação exponencial:
                <code className="block mt-1 px-2.5 py-1.5 rounded bg-slate-200/70 dark:bg-[#131f33] text-indigo-600 dark:text-indigo-400 font-mono">
                  Score Atual = Score Base × e^(-λ × dias_sem_estudar)
                </code>
              </p>
            </div>
          </div>

          {/* Bloco 4: O que melhora vs O que piora o Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <TrendingUp size={15} /> O que faz seu Score SUBIR e durar mais
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                <li>
                  <strong>Resolver questões com alto acerto (≥ 80%):</strong> Eleva rapidamente o Score Base.
                </li>
                <li>
                  <strong>Estudar o tópico em vários dias diferentes:</strong> O fator de memória de longo prazo (<code className="font-mono">1 / √dias</code>) reduz a taxa de esquecimento λ — cada revisão concluída torna o esquecimento mais lento!
                </li>
                <li>
                  <strong>Aumentar o Domínio Declarado (0–5)</strong> no Cockpit do Tópico após dominar a teoria.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                <TrendingDown size={15} /> O que faz seu Score CAIR mais rápido
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                <li>
                  <strong>Muitos dias sem revisar:</strong> A curva exponencial reduz o Score Atual até ele entrar na fila de urgência (&lt; 65 pts).
                </li>
                <li>
                  <strong>Alta Relevância (4–5) e Alta Dificuldade (4–5):</strong> Tópicos marcados como muito importantes na prova e difíceis têm um λ maior (+8% por ponto), cobrando revisões mais frequentes para você não correr risco na prova.
                </li>
                <li>
                  <strong>Errar muitas questões na bateria:</strong> Reduz imediatamente o Score Base e antecipa a próxima revisão para 3 a 6 dias.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#1a293e] bg-slate-50/50 dark:bg-[#0c1421]/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 size={15} />
            Entendi como funciona
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreTutorialModal;
