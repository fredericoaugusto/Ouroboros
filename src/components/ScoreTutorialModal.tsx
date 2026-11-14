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
    badge: 'Passo 1 de 6 • Ideia Principal',
    title: 'Como o Sistema Decide o Dia Certo da Sua Revisão',
    subtitle: 'Sem revisões fixas acumuladas (7, 15, 30 dias) — tudo se adapta ao seu ritmo real',
    icon: Sparkles,
  },
  {
    id: 1,
    badge: 'Passo 2 de 6 • O que forma sua Nota',
    title: 'O Que Faz Sua Nota (Score de 0 a 100) Subir ou Descer',
    subtitle: 'Explicado de forma simples: questões, segurança no assunto e constância',
    icon: Layers,
  },
  {
    id: 2,
    badge: 'Passo 3 de 6 • Suas Escolhas no Tópico',
    title: 'Relevância na Prova × Dificuldade × Seu Domínio',
    subtitle: 'Como os botões de 0 a 5 mudam o cuidado do sistema com cada assunto',
    icon: Sliders,
  },
  {
    id: 3,
    badge: 'Passo 4 de 6 • Nota vs. Memória Fresca',
    title: 'Qual a Diferença entre Score (Nota) e Retenção (Memória)?',
    subtitle: 'E como os seus Simulados ajudam a calibrar a matéria inteira',
    icon: Award,
  },
  {
    id: 4,
    badge: 'Passo 5 de 6 • Seu Ritmo Pessoal',
    title: 'O Sistema Aprende com a Sua Memória',
    subtitle: 'Ele percebe se você lembra bem depois de semanas ou se precisa revisar mais cedo',
    icon: UserCheck,
  },
  {
    id: 5,
    badge: 'Passo 6 de 6 • Resumo Prático',
    title: 'No Dia a Dia: O que Faz Subir vs. O que Faz Cair',
    subtitle: 'Um guia rápido para manter suas matérias verdes até o dia da prova',
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
                  Por que não usamos revisões fixas de 7, 15 e 30 dias?
                </h3>
                <p>
                  Se você estuda um assunto super fácil e acerta 95% das questões, revisar daqui a 7 dias é perda de tempo. Por outro lado, se você estudou um assunto difícil e acertou só 40%, esperar 15 dias faz você esquecer tudo!
                </p>
                <p>
                  Por isso, o <strong>Krono</strong> dá uma <strong>Nota de 0 a 100 (Score)</strong> para cada assunto e calcula sob medida daqui a quantos dias (ex.: <code className="text-emerald-500 font-bold">+3d</code>, <code className="text-emerald-500 font-bold">+8d</code>, <code className="text-emerald-500 font-bold">+14d</code>, <code className="text-emerald-500 font-bold">+25d</code>) sua memória começará a esfriar, agendando a revisão na hora certa.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-extrabold text-[10px] mb-2">
                    1 • QUANDO VOCÊ ESTUDA
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Olha Tudo o que Você Fez
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Analisa quantas questões você acertou no total, como foi seu último estudo, os simulados da matéria e se você acha o assunto fácil ou difícil.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-extrabold text-[10px] mb-2">
                    2 • COM O PASSAR DOS DIAS
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Acompanha Sua Memória
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No dia em que você estuda, sua memória daquele tema está em <strong>100%</strong>. A cada dia sem ver o assunto, ela vai esfriando aos poucos, como acontece na vida real.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-extrabold text-[10px] mb-2">
                    3 • NA HORA DE REVISAR
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                    Avisa o Dia Ideal + Dica Prática
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Antes de você esquecer o conteúdo, o tópico entra na sua fila de Revisões já dizendo se vale mais a pena ler seu resumo, ver a teoria ou ir direto para questões.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 1: O QUE FORMA A NOTA */}
          {currentSlide === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sua <strong>Nota (Score de 0 a 100)</strong> não olha apenas uma coisa isolada. Veja de forma simples o que entra na conta:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">1. Seus Acertos nas Questões</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      Principal Fator
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quanto mais questões você resolve e acerta no assunto, maior fica sua nota. Se você fez poucas questões (ex: só 4 ou 5), o sistema vai com calma até você ter uma amostra maior.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">2. Como Você Foi no Último Estudo</strong>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold text-[10px]">
                      Termômetro Recente
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    A última vez que você estudou tem um peso especial: se você vinha errando e hoje acertou 90%, sua nota sobe rápido. Se hoje você foi mal, o sistema antecipa a revisão para te proteger.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">3. Seu Domínio Declarado (0 a 5)</strong>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold text-[10px]">
                      Ajuda no Início
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quando você começa um tópico novo e ainda fez poucas questões, a nota que você dá para o seu próprio domínio ajuda bastante. Depois que você já fez dezenas de questões, o que manda mesmo são seus acertos reais!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a]">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 dark:text-white">4. Estudar em Dias Diferentes + Simulados</strong>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px]">
                      Memória Duradoura
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Revisar um assunto em 3 ou 4 dias separados fixa muito mais do que estudar 4 horas num único dia. Além disso, suas notas nos <strong>Simulados</strong> também ajudam a compor a nota da matéria!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: MATRIZ R x D x P */}
          {currentSlide === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dentro de cada tópico (ou logo no 1º estudo), você pode marcar de 0 a 5 a <strong>Relevância na prova</strong>, a <strong>Dificuldade</strong> e o seu <strong>Domínio</strong>. Veja na prática o que cada combinação faz:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-500 uppercase text-[11px]">
                      Cenário A • Assunto Tranquilo e Dominado
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[10px]">
                      Revisão espaçada (+20d a +40d)
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Domínio Alto (4–5) + Dificuldade Baixa (1–2) + Ótimos Acertos:</strong> O sistema vê que você já aprendeu de verdade. Sua memória segura por muitas semanas e ele não fica ocupando seu tempo à toa.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-rose-400 uppercase text-[11px]">
                      Cenário B • Cai Muito na Prova e Você Acha Difícil
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px]">
                      Revisão rápida (+2d a +5d)
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Relevância Alta (4–5) + Dificuldade Alta (4–5) + Domínio Baixo (0–2):</strong> Alerta máximo para a sua aprovação! O sistema coloca esse tópico no topo da prioridade e agenda revisões curtinhas até você dominar.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 uppercase text-[11px]">
                      Cenário C • Fácil, Mas Despenca na Prova
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                      Revisão média (+10d a +16d)
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Dificuldade Baixa (1–2) + Relevância Máxima (5):</strong> Mesmo sendo fácil para você, como vale muitos pontos no edital, o sistema exige uma segurança maior na memória e não deixa você passar meses sem ver.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/25 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-indigo-400 uppercase text-[11px]">
                      Cenário D • Assunto Difícil, Mas Raro na Prova
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold text-[10px]">
                      Sem sufocar seu ciclo
                    </span>
                  </div>
                  <p className="text-[11px]">
                    <strong>Relevância Baixa (1) + Dificuldade Alta (4–5):</strong> O sistema agenda reforço porque você sentiu dificuldade, mas não deixa esse tópico roubar o lugar dos assuntos de Relevância 5 que realmente decidem sua aprovação!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: SCORE VS RETENÇÃO */}
          {currentSlide === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-extrabold text-xs uppercase">
                    <Award className="w-4 h-4" />
                    Sua Nota (Score de 0 a 100)
                  </div>
                  <p className="text-[11px]">
                    Pense no <strong>Score</strong> como a sua <strong>preparação geral naquele assunto para o dia da prova</strong>:
                  </p>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-500 dark:text-slate-400">
                    <li>
                      <strong>Acima de 75 (Verde):</strong> Assunto forte e bem dominado.
                    </li>
                    <li>
                      <strong>Entre 50 e 74 (Amarelo):</strong> Em construção — precisa de mais questões ou revisão para ficar seguro.
                    </li>
                    <li>
                      <strong>Abaixo de 50 (Vermelho):</strong> Ponto fraco ou esquecido — pede atenção prioritária.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase">
                    <Activity className="w-4 h-4" />
                    Memória Fresca Hoje (Retenção %)
                  </div>
                  <p className="text-[11px]">
                    Já a <strong>Retenção (%)</strong> mostra <strong>o quão fresco aquele assunto está na sua cabeça hoje</strong>:
                  </p>
                  <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-slate-500 dark:text-slate-400">
                    <li>
                      No dia em que você estuda, ela fica perto de <strong>100%</strong>.
                    </li>
                    <li>
                      Conforme os dias passam sem você tocar no assunto, ela vai descendo aos poucos (95%... 86%... 78%).
                    </li>
                    <li>
                      Quando ela encosta no limite de segurança (por volta de 75% a 85%), o sistema te chama para revisar!
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-300">
                <strong>E a Nota Geral da Disciplina?</strong> Ela junta a nota de todos os tópicos daquela matéria (dando mais importância aos tópicos que mais caem na prova) com os seus resultados nos <strong>Simulados</strong>!
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
                    Seu Ritmo Pessoal de Memória Hoje
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs">
                    Ritmo da sua memória: {userProfile.personalRetentionFactor}x
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                  {userProfile.summaryText}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Se você costuma lembrar bem nas revisões
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Quando você volta para revisar um tópico depois de uma ou duas semanas e continua acertando muitas questões, o sistema percebe que sua memória fixa bem e passa a te dar intervalos mais confortáveis.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0d1626] border border-slate-200 dark:border-[#1f304a] space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Se você sentir que esqueceu rápido
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Se ao fazer uma revisão seu índice de acertos cair bastante em relação à vez anterior, o sistema encurta automaticamente os prazos das próximas revisões para não deixar você esquecer o conteúdo.
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
                  ▲ O Que Faz Sua Nota Subir e Durar Mais
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>
                    <strong>Resolver questões e manter bom acerto:</strong> É o combustível número 1 para subir sua nota com segurança.
                  </li>
                  <li>
                    <strong>Revisar em dias separados:</strong> Cada vez que você revisa um assunto num dia diferente e vai bem, o tempo que sua memória aguenta aumenta (ex: de 4 dias vai para 9 dias, depois 18 dias...).
                  </li>
                  <li>
                    <strong>Fazer questões tentando lembrar antes de ler o resumo:</strong> Esforçar a memória para responder questões fixa muito mais do que só reler teoria.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/[0.06] border border-rose-500/25 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-500 font-extrabold text-xs uppercase tracking-wider">
                  <TrendingDown className="w-4 h-4" />
                  ▼ O Que Faz Sua Nota Cair
                </div>
                <ul className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>
                    <strong>Ficar muitas semanas sem ver o assunto:</strong> A memória vai esfriando dia após dia até o tópico pedir revisão.
                  </li>
                  <li>
                    <strong>Errar muitas questões na última bateria:</strong> Se você tropeçar num treino recente, a nota desce para chamar uma revisão rápida de correção.
                  </li>
                  <li>
                    <strong>Estudar só teoria sem fazer nenhuma questão:</strong> Sem questões feitas, a nota fica travada num patamar moderado porque ainda falta testar na prática.
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
