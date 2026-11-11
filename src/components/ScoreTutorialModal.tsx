'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Brain,
  Sliders,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Award,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useSidebar } from '../context/SidebarContext';
import { useData } from '../context/DataContext';
import { computeUserMemoryProfile } from '../lib/scoreEngine';

interface ScoreTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    id: 0,
    badge: 'Slide 1 de 6 • Filosofia do Sistema',
    title: 'O Score é quem comanda suas Revisões',
    subtitle: 'Sem datas fixas engessadas (7, 15, 30 dias) e sem depender apenas de % isolado',
    icon: Sparkles,
  },
  {
    id: 1,
    badge: 'Slide 2 de 6 • Composição Matemática',
    title: 'Os 6 Pilares que formam o Score (0 a 100)',
    subtitle: 'Tudo o que você faz na plataforma alimenta o cálculo em conjunto',
    icon: Layers,
  },
  {
    id: 2,
    badge: 'Slide 3 de 6 • Matriz de Exigência',
    title: 'Relevância × Dificuldade × Domínio Declarado',
    subtitle: 'Como diferentes combinações mudam seu Score e a frequência de revisão',
    icon: Sliders,
  },
  {
    id: 3,
    badge: 'Slide 4 de 6 • Visão Macro & Micro',
    title: 'Score da Disciplina, Simulados & Retenção (%)',
    subtitle: 'Como os Simulados entram na conta e a diferença entre Score e Retenção',
    icon: Award,
  },
  {
    id: 4,
    badge: 'Slide 5 de 6 • Aprendizado Individual',
    title: 'Como o Sistema Aprende com o Seu Histórico',
    subtitle: 'Calibração adaptativa baseada na sua retenção real ao longo do tempo',
    icon: UserCheck,
  },
  {
    id: 5,
    badge: 'Slide 6 de 6 • Guia Prático de Uso',
    title: 'Como Subir seu Score e Evitar Quedas',
    subtitle: 'O que fazer no dia a dia para consolidar o edital até a prova',
    icon: TrendingUp,
  },
];

export default function ScoreTutorialModal({ isOpen, onClose }: ScoreTutorialModalProps) {
  const { isSidebarExpanded } = useSidebar();
  const { studyRecords, simuladoRecords } = useData();
  const [currentSlide, setCurrentSlide] = useState(0);

  const userProfile = useMemo(
    () => computeUserMemoryProfile(studyRecords || [], simuladoRecords || []),
    [studyRecords, simuladoRecords]
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentSlide((prev) => Math.min(SLIDES.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const slideMeta = SLIDES[currentSlide];
  const SlideIcon = slideMeta.icon;

  return (
    <div
      className={`!mt-0 fixed top-0 right-0 bottom-14 ${
        isSidebarExpanded ? 'lg:left-64 left-0' : 'left-0'
      } z-[65] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn`}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#243552] rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1f304a] flex items-center justify-between bg-slate-50/70 dark:bg-[#0d1626]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <SlideIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 block">
                {slideMeta.badge}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {slideMeta.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {slideMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2942] transition-colors shrink-0"
            title="Fechar apresentação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Pills Bar */}
        <div className="px-6 py-2.5 bg-slate-100/60 dark:bg-[#0b1320]/70 border-b border-slate-100 dark:border-[#1f304a] flex items-center justify-between gap-2 overflow-x-auto">
          {SLIDES.map((s, idx) => {
            const isCurrent = idx === currentSlide;
            const isPast = idx < currentSlide;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  isCurrent
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : isPast
                    ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#16243d]'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-black/15 dark:bg-white/10 flex items-center justify-center text-[10px]">
                  {idx + 1}
                </span>
                <span className="hidden md:inline">
                  {idx === 0
                    ? 'Visão Geral'
                    : idx === 1
                    ? '6 Pilares'
                    : idx === 2
                    ? 'Matriz R×D×P'
                    : idx === 3
                    ? 'Disciplina & Retenção'
                    : idx === 4
                    ? 'IA Pessoal'
                    : 'Subir vs Cair'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slide Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[340px]">
          {/* SLIDE 0: VISÃO GERAL */}
          {currentSlide === 0 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-500" />
                  Por que não usamos ciclos fixos (1, 7, 15, 30 dias) nem apenas % de acerto?
                </h3>
                <p>
                  Em plataformas tradicionais, ou você agenda revisões fixas (que viram uma bola de neve impossível de cumprir) ou olha apenas a % de questões de uma sessão isolada. Aqui o centro de tudo é o <strong>SCORE (0 a 100)</strong>.
                </p>
                <p>
                  Toda vez que você registra um estudo, o sistema calcula o <strong>Novo Score daquele tópico</strong> cruzando <strong>6 variáveis</strong> do seu histórico e projeta na curva de esquecimento o <strong>dia exato</strong> (ex.: <code className="text-emerald-500 font-bold">+4d</code>, <code className="text-emerald-500 font-bold">+9d</code>, <code className="text-emerald-500 font-bold">+11d</code>, <code className="text-emerald-500 font-bold">+17d</code>, <code className="text-emerald-500 font-bold">+26d</code>) em que você precisará revisar antes de esquecer.
                </p>
              </div>

              {/* Fluxograma Visual */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-extrabold text-[10px] mb-2">
                    PASSO 1 • ENTRADAS
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Agregação Multi-Fatorial
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Junta histórico do tópico + última sessão + histórico da disciplina + Simulados + Relevância/Dificuldade/Domínio + seu Perfil Pessoal.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-extrabold text-[10px] mb-2">
                    PASSO 2 • MOTOR DE SCORE
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Score (0–100) & Retenção (%)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Calcula seu <strong>Score Base</strong> e aplica a taxa de esquecimento diária (<code className="text-emerald-400">λ</code>) para obter a <strong>Retenção Atual (%)</strong> e o <strong>Score Atual</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-extrabold text-[10px] mb-2">
                    PASSO 3 • AGENDAMENTO EXATO
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Dias Quebrados Sob Medida
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Resolve a equação contínua para descobrir exatamente em quantos dias (<code className="text-amber-400">3d, 6d, 11d, 14d, 23d...</code>) sua retenção cairá até o limite de segurança.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 1: OS 6 PILARES DO SCORE */}
          {currentSlide === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O <strong>Score do Tópico (0 a 100)</strong> nunca olha um único dado isolado. Ele pondera dinamicamente os 6 pilares abaixo:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">1. Histórico Acumulado do Tópico</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      Peso Base Alto
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Soma todas as questões já feitas naquele tópico em todas as sessões anteriores, suavizadas para evitar distorções quando há poucas questões.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">2. Último Registro / Sessão Atual</strong>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold text-[10px]">
                      38% das Questões
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    A última bateria registrada tem peso direto de 38% sobre o componente de questões: se hoje você foi mal num tópico que ia bem, o Score sente na hora e encurta a revisão!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">3. Contexto da Disciplina + Simulados</strong>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold text-[10px]">
                      12% a 45%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seu desempenho geral na matéria e nos <strong>Simulados</strong> funciona como âncora: se você domina a disciplina como um todo, tópicos novos partem de um patamar mais fiel à sua realidade.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">4. Domínio Declarado (0 a 5)</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      10% a 55%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sua percepção subjetiva no Cockpit do Tópico. Tem peso maior quando você ainda fez poucas questões (até 55%) e vai cedendo espaço para os dados reais conforme você resolve baterias (10%).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">5. Relevância (R) e Dificuldade (D)</strong>
                    <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold text-[10px]">
                      Modificador ±15 pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Altera diretamente tanto a nota do Score quanto a velocidade de esquecimento (<code className="text-rose-400">λ</code>) e a régua de exigência da revisão.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">6. Tempo Tópico (82%) + Disciplina (18%)</strong>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold text-[10px]">
                      Decaimento Diário
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Avalia há quantos dias você não estuda o tópico E há quantos dias você não toca na disciplina como um todo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: MATRIZ R x D x P */}
          {currentSlide === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No Cockpit de cada tópico você pode ajustar <strong>Relevância (0–5)</strong>, <strong>Dificuldade (0–5)</strong> e <strong>Domínio Declarado (0–5)</strong>. Veja como as combinações afetam o cálculo junto às questões:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-500 uppercase text-[11px]">
                      Cenário A • Domínio Forte & Baixa Dificuldade
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[10px]">
                      Ex.: +21d, +28d, +36d
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Domínio Alto (4–5) + Dificuldade Baixa (1–2) + Acerto Alto (≥80%):</strong> O sistema entende que você já domina a matéria e valida isso nas questões. O Score fica alto (80–95), a curva <code className="text-emerald-400">λ</code> desacelera e você revisa bem menos.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-400 uppercase text-[11px]">
                      Cenário B • Alta Relevância, Difícil & Baixo Domínio
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px]">
                      Ex.: +3d, +4d, +6d
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Relevância Alta (4–5) + Dificuldade Alta (4–5) + Domínio Baixo (0–2):</strong> Ponto crítico de prova! O Score sofre penalidade de cautela, a taxa <code className="text-rose-400">λ</code> acelera e a régua de retenção sobe para ~80%, chamando revisão em poucos dias.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 uppercase text-[11px]">
                      Cenário C • Fácil, Domínio Médio, mas Alta Relevância
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                      Ex.: +11d, +14d, +16d
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Dificuldade Baixa (1–2) + Domínio Intermediário (3) + Relevância Alta (5):</strong> Mesmo sendo um assunto tranquilo, como ele despenca em prova (Relevância 5), o sistema não deixa você ficar 40 dias sem vê-lo — mantém revisões intermediárias (~11 a 16 dias).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-400 uppercase text-[11px]">
                      Cenário D • Baixa Relevância, Difícil & Baixo Domínio
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold text-[10px]">
                      Ex.: +7d, +9d, +12d
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Relevância Baixa (1) + Dificuldade Alta (4–5) + Domínio Baixo (1):</strong> O Score fica baixo porque você tem dificuldade, pedindo reforço, mas como a Relevância na prova é 1, a régua de retenção é mais tolerante (70%), sem sufocar os tópicos de peso 5.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: SCORE DA DISCIPLINA, SIMULADOS & RETENÇÃO */}
          {currentSlide === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-extrabold text-xs uppercase">
                    <Award className="w-4 h-4" />
                    Score Geral da Disciplina + Simulados
                  </div>
                  <p className="text-[11px]">
                    Cada matéria possui seu <strong>Score Geral da Disciplina (0 a 100)</strong>. Como nos <strong>Simulados</strong> você cadastra o resultado por disciplina (e não por subtópico), o sistema faz a fusão inteligente:
                  </p>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-500 dark:text-slate-400">
                    <li>
                      Calcula a <strong>média ponderada dos Scores dos tópicos</strong> daquela disciplina (dando mais peso aos tópicos de maior Relevância).
                    </li>
                    <li>
                      Integra a nota dos seus <strong>Simulados</strong> naquela matéria (28% do Score da Disciplina) E usa o resultado dos Simulados para calibrar o Score de todos os tópicos daquela matéria!
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase">
                    <Activity className="w-4 h-4" />
                    Score (0–100) vs. Retenção Atual (0–100%)
                  </div>
                  <p className="text-[11px]">
                    Ao abrir qualquer tópico (ex.: <em>1.1 Princípios LIMPE</em>), você verá dois indicadores lado a lado:
                  </p>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-500 dark:text-slate-400">
                    <li>
                      <strong>Score (0 a 100 pts):</strong> Mede sua <strong>força competitiva real</strong> naquele assunto (qualidade de acerto + domínio + peso + memória ativa).
                    </li>
                    <li>
                      <strong>Retenção (0% a 100%):</strong> Mede o <strong>frescor na memória hoje</strong>. No dia em que você estuda, a Retenção vai a <strong>100%</strong> e cai dia após dia segundo <code className="text-indigo-400">e^(-λ·t)</code> até atingir o ponto ideal da próxima revisão.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-300">
                <strong>Importante no Cockpit do Tópico:</strong> A contagem de <strong>Questões, Acertos e % de Acerto</strong> dentro da página de notas do tópico é <strong>100% automática e auditável</strong> — alimentada exclusivamente pelos seus registros reais de estudo!
              </div>
            </div>
          )}

          {/* SLIDE 4: INTELIGÊNCIA ADAPTATIVA PESSOAL */}
          {currentSlide === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-emerald-500 uppercase flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    Seu Perfil de Memória Atual no Sistema
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs">
                    Fator Pessoal α = {userProfile.personalRetentionFactor}x
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                  {userProfile.summaryText}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    1º Contato com uma Disciplina/Tópico Novo
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Exemplo: você estudou um tópico pela 1ª vez, fez <strong>10 questões e errou 7 (30% de acerto)</strong>. O sistema calcula imediatamente o <strong>Novo Score pós-sessão</strong> (~34 pts), cruza com seu fator pessoal <code className="text-emerald-500">α</code> e já sugere uma revisão curtíssima (ex.: <strong>3 ou 4 dias</strong>).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Aprendizado nas Revisões Seguintes
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quando você revisa um tópico após <code className="text-emerald-500">X dias</code>, o algoritmo compara seu % de acerto anterior com o novo: se você mantém ou sobe seu acerto após intervalos médios/longos, seu <code className="text-emerald-500">α</code> sobe (até 1.45x); se seu acerto costuma cair mais rápido que o esperado, seu <code className="text-rose-400">α</code> reduz (até 0.65x), antecipando automaticamente suas próximas revisões!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 5: COMO SUBIR VS CAIR */}
          {currentSlide === 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4" />
                  O que faz seu Score Subir e Durar Mais
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>
                    <strong>Acertar questões nas baterias recentes:</strong> Eleva o Score Base imediatamente (38% de peso na sessão mais recente + 62% no acumulado).
                  </li>
                  <li>
                    <strong>Acumular sessões em dias distintos:</strong> O fator <code className="text-emerald-500">√N_sessões</code> reduz o decaimento <code className="text-emerald-500">λ</code> — cada revisão concluída deixa sua memória mais blindada.
                  </li>
                  <li>
                    <strong>Ir bem nos Simulados da Disciplina:</strong> Sobe o Score Geral da matéria e puxa positivamente a âncora de todos os tópicos dela.
                  </li>
                  <li>
                    <strong>Evoluir seu Domínio Declarado (0–5)</strong> no Cockpit conforme sentir segurança real na matéria.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/[0.06] border border-rose-500/25 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-500 font-extrabold text-xs uppercase tracking-wider">
                  <TrendingDown className="w-4 h-4" />
                  O que faz seu Score Cair Mais Rápido
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>
                    <strong>Abandonar o Tópico ou a Disciplina por semanas:</strong> A Retenção cai diariamente (<code className="text-rose-400">82% tempo do tópico + 18% tempo da disciplina</code>), reduzindo o Score Atual até entrar em Urgência.
                  </li>
                  <li>
                    <strong>Queda brusca na última bateria de questões:</strong> Se você errar muitas questões hoje, o peso recente derruba o Score para forçar uma revisão curta de recuperação.
                  </li>
                  <li>
                    <strong>Tópicos com Relevância 4–5 e Dificuldade 4–5:</strong> Possuem decaimento natural mais rigoroso para garantir que você nunca vá para a prova sem dominá-los.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-[#1f304a] bg-slate-50/70 dark:bg-[#0d1626] flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={currentSlide === 0}
            onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
            title="Anterior"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-[#243552] bg-white dark:bg-[#131f33] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2942] disabled:opacity-35 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentSlide
                    ? 'w-6 bg-emerald-500'
                    : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-emerald-400'
                }`}
                title={s.title}
              />
            ))}
          </div>

          {currentSlide < SLIDES.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => Math.min(SLIDES.length - 1, prev + 1))}
              title="Próximo"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
