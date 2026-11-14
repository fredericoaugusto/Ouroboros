'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Award,
  BookOpen,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Image as ImageIcon,
  PenTool,
  KeyRound,
  History,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  TrendingUp,
  AlertTriangle,
  Printer,
  FileCode2,
  LayoutGrid,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useNotification } from '../../context/NotificationContext';
import UserAiKeyModal from '../../components/UserAiKeyModal';
import {
  parseDiscursiveReport,
  buildHistoricalIntelligence,
  StructuredDiscursiveReport,
} from '../../lib/discursiveReportParser';

type DiscursiveModality = 'redacao' | 'questao_discursiva' | 'peca_pratica';

interface SavedEssayEvaluation {
  id: string;
  date: string;
  modality: DiscursiveModality;
  banca: string;
  subjectName?: string;
  topicName?: string;
  themeTitle: string;
  studentEssay: string;
  correctionReport: string;
}

const BANCA_PROFILES: Record<
  string,
  {
    label: string;
    description: string;
    defaultRule: string;
    originExplanation: string;
    defaultMaxScore: number;
    defaultLines: number;
  }
> = {
  cebraspe: {
    label: 'Cebraspe (CESPE)',
    description:
      'Exige resposta direta aos quesitos na ordem proposta, sem introdução genérica ("nariz de cera"). Valoriza objetividade, precisão terminológica e aplica desconto proporcional de erros gramaticais pelo total de linhas efetivamente escritas.',
    defaultRule:
      'NF = NC - 2 × (NE / TL), onde NC = Nota de Conteúdo (Apresentação/Estrutura 5% a 10% + Quesitos de Conteúdo 90% a 95%), NE = Número de Erros Gramaticais e TL = Total de Linhas efetivamente escritas.',
    originExplanation:
      'Padrão oficial retirado dos editais clássicos do Cebraspe (PRF, PF, Tribunais e Controladorias). Se o seu edital usar multiplicador diferente (ex: 4 × NE/TL ou nota máxima 20/30 pts), basta colar o trecho no "Leitor de Edital com IA" ou editar os campos abaixo.',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
  fgv: {
    label: 'FGV (Fundação Getulio Vargas)',
    description:
      'Cobra análise crítica profunda, subsunção do caso concreto à norma/jurisprudência do STF e STJ, coesão argumentativa e domínio da norma culta.',
    defaultRule:
      'Avaliação composta por Parte Macroestrutural / Domínio do Tema e Argumentação (80% da nota) + Parte Microestrutural / Norma Culta e Coesão (20% da nota).',
    originExplanation:
      'Baseado nos espelhos de correção da FGV (Receita Federal, Tribunais, Fazendas e Carreiras Policiais). Você pode adaptar a distribuição de pontos colando seu edital no botão "Configurar pelo Edital (IA)".',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
  fcc: {
    label: 'FCC (Fundação Carlos Chagas)',
    description:
      'Valoriza estrutura dissertativo-argumentativa clássica (tese clara na introdução, parágrafos de desenvolvimento com repertório sólido e conclusão propositiva ou sintética), clareza e correção gramatical.',
    defaultRule:
      'Conteúdo e Desenvolvimento do Tema (60 pts) + Estrutura e Argumentação (20 pts) + Expressão e Norma Culta (20 pts) = Total 100 pts.',
    originExplanation:
      'Extraído da grade padrão de redação e estudos de caso da FCC (TRTs, TRFs e SEFAZ). Totalmente editável abaixo.',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
  cesgranrio: {
    label: 'Cesgranrio',
    description:
      'Exige texto dissertativo-argumentativo com adequação ao tema, articulação de ideias, repertório sociocultural produtivo e respeito rigoroso às margens e limite de linhas.',
    defaultRule:
      'Adequação ao tema e tipologia (20%) + Argumentação e Coerência (30%) + Coesão textual (20%) + Modalidade escrita formal (30%) = 100 pts.',
    originExplanation:
      'Baseado na matriz de referência da Cesgranrio (CNU, Banco do Brasil, Caixa e Petrobras).',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
  vunesp: {
    label: 'Vunesp',
    description:
      'Foco em fidelidade aos textos motivadores sem cópia literal, resposta completa a cada item do comando e rigor com regência, concordância e pontuação.',
    defaultRule:
      'Tema e Visão Crítica (40%) + Estrutura e Coerência/Coesão (30%) + Norma-Padrão da Língua Portuguesa (30%) = 100 pts.',
    originExplanation:
      'Baseado nos critérios oficiais da Vunesp (TJ-SP, PC-SP e Prefeituras/Câmaras).',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
  personalizada: {
    label: 'Extraída do Seu Edital (Personalizada via IA)',
    description:
      'Regras, pesos e critérios extraídos diretamente do texto do seu edital pela Inteligência Artificial ou ajustados manualmente por você.',
    defaultRule: 'Cole o trecho do seu edital no Leitor de Edital com IA ou digite sua regra personalizada aqui.',
    originExplanation:
      'Configuração personalizada ativa: segue exatamente a fórmula e os limites extraídos do seu próprio edital.',
    defaultMaxScore: 100,
    defaultLines: 30,
  },
};

function VisualCorrectionReportCard({
  reportText,
  bancaLabel,
  defaultMaxScore,
  defaultLines,
  onCopyRaw,
  copied,
}: {
  reportText: string;
  bancaLabel: string;
  defaultMaxScore: number;
  defaultLines: number;
  onCopyRaw?: () => void;
  copied?: boolean;
}) {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');

  const parsed: StructuredDiscursiveReport = useMemo(
    () => parseDiscursiveReport(reportText, defaultMaxScore, defaultLines),
    [reportText, defaultMaxScore, defaultLines]
  );

  const scorePct =
    parsed.maxScore > 0 ? Math.min(100, Math.round((parsed.finalNetScore / parsed.maxScore) * 100)) : 0;

  const formatNum = (n: number) =>
    Number(n || 0)
      .toFixed(2)
      .replace('.', ',');

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      {/* Barra de Topo do Laudo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1f304a] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
            <Award size={20} />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-500 block">
              Laudo Oficial de Correção • {bancaLabel}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {parsed.formulaSummary}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#0b1320] p-1 border border-slate-200 dark:border-[#1f304a]">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'visual'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={13} />
              Painel Visual
            </button>
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'raw'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <FileCode2 size={13} />
              Texto Original
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-500"
            title="Imprimir ou Salvar Laudo Formatado em PDF"
          >
            <Printer size={13} />
            Imprimir / PDF
          </button>

          {onCopyRaw && (
            <button
              type="button"
              onClick={onCopyRaw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'raw' ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
          {reportText}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Cards de Indicadores Oficiais (KPIs) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Nota de Conteúdo (NC)
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {formatNum(parsed.contentScore)}{' '}
                <span className="text-xs font-semibold text-slate-400">/ {parsed.maxScore}</span>
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                Macroestrutura + Quesitos
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Linhas Escritas (TL)
              </span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {parsed.totalLines}{' '}
                <span className="text-xs font-semibold text-slate-400">linhas</span>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold mt-1 block">
                Base p/ cálculo proporcional
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Desvios Gramaticais (NE)
              </span>
              <div className="text-xl font-black text-amber-500 mt-1">
                {parsed.grammarErrorsCount}{' '}
                <span className="text-xs font-semibold text-slate-400">erros</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                Microestrutura linha a linha
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/[0.06] border border-rose-500/25">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 block">
                Penalidade / Desconto
              </span>
              <div className="text-xl font-black text-rose-500 mt-1">
                -{formatNum(parsed.grammarDeduction)}{' '}
                <span className="text-xs font-semibold text-rose-400/80">pts</span>
              </div>
              <span className="text-[11px] text-rose-400/90 font-medium mt-1 block">
                Desconto na norma culta
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-indigo-500/10 border-2 border-emerald-500/50 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                NOTA FINAL LÍQUIDA (NF)
              </span>
              <div className="text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-1">
                {formatNum(parsed.finalNetScore)}{' '}
                <span className="text-xs font-bold text-slate-400">/ {parsed.maxScore}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${scorePct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Comparativo com o Histórico do Aluno (se presente) */}
          {parsed.historicalComparison &&
            (parsed.historicalComparison.improvedPoints.length > 0 ||
              parsed.historicalComparison.recurringAlerts.length > 0 ||
              parsed.historicalComparison.summary) && (
              <div className="p-5 rounded-2xl bg-indigo-500/[0.06] border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-400" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                    Diagnóstico de Evolução (Comparado às Suas Redações Anteriores)
                  </h4>
                </div>
                {parsed.historicalComparison.summary && (
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {parsed.historicalComparison.summary}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {parsed.historicalComparison.improvedPoints.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block mb-1.5">
                        ✅ O que você evoluiu neste texto
                      </span>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-disc list-inside">
                        {parsed.historicalComparison.improvedPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsed.historicalComparison.recurringAlerts.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 block mb-1.5">
                        ⚠️ Atenção: Erros Recorrentes que Repetiram
                      </span>
                      <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200 list-disc list-inside">
                        {parsed.historicalComparison.recurringAlerts.map((al, i) => (
                          <li key={i}>{al}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* 3. Avaliação por Quesito do Espelho (Macroestrutura) */}
          {parsed.criteria.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                🎯 Desempenho por Quesito do Espelho Oficial
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsed.criteria.map((c, idx) => {
                  const pct = c.max > 0 ? Math.min(100, Math.round((c.obtained / c.max) * 100)) : 100;
                  const lost = c.deduction > 0;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white leading-snug">
                            {c.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {lost ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-extrabold text-rose-400">
                                -{formatNum(c.deduction)} pts
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400">
                                Gabaritou!
                              </span>
                            )}
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {formatNum(c.obtained)} / {formatNum(c.max)}
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 85
                                ? 'bg-emerald-500'
                                : pct >= 65
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {c.feedback && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-200/70 dark:border-[#17263f]">
                          {c.feedback}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Tabela Visual de Correção Microestrutural Linha a Linha */}
          {parsed.lineErrors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  🔍 Correção Microestrutural Linha a Linha ({parsed.lineErrors.length} apontamentos)
                </h4>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1f304a]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#09111e] text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1f304a]">
                      <th className="py-2.5 px-3 w-24">Linha</th>
                      <th className="py-2.5 px-3 w-40">Tipo de Desvio</th>
                      <th className="py-2.5 px-3">Como Você Escreveu</th>
                      <th className="py-2.5 px-3">Correção Recomendada</th>
                      <th className="py-2.5 px-3">Regra / Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1f304a] bg-white dark:bg-[#0b1320]">
                    {parsed.lineErrors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-[#131f33]/60">
                        <td className="py-3 px-3 font-mono font-bold text-indigo-400 whitespace-nowrap">
                          {err.line.toLowerCase().includes('linha') ? err.line : `Linha ${err.line}`}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                            {err.category}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-1 rounded bg-rose-500/10 text-rose-400 line-through font-medium">
                            {err.original}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                            {err.correction}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                          {err.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Análise de Conteúdo e Argumentação por Parágrafo */}
          {parsed.paragraphAnalysis.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                📑 Diagnóstico de Conteúdo & Argumentação por Parágrafo
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsed.paragraphAnalysis.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-2"
                  >
                    <span className="text-xs font-extrabold text-indigo-400 block">
                      {p.paragraph}
                    </span>
                    {p.strengths && (
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <strong className="text-emerald-400">Pontos Fortes / Diagnóstico: </strong>
                        {p.strengths}
                      </p>
                    )}
                    {p.improvements && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong className="text-amber-400">Como Aprofundar: </strong>
                        {p.improvements}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Plano de Ação Prático para a Próxima Redação */}
          {parsed.actionPlan.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/30 space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                🚀 3 Focos Prioritários para Subir Sua Nota no Próximo Treino
              </h4>
              <ul className="space-y-1.5">
                {parsed.actionPlan.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 7. Reescrita Modelo Nota Máxima */}
          {parsed.modelRewrite && (
            <div className="p-5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  🏆 Versão Nota Máxima (Reescrita Modelo no Padrão {bancaLabel})
                </h4>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#09111e] border border-emerald-500/20 text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                {parsed.modelRewrite}
              </div>
            </div>
          )}

          {/* Caso seja um texto livre que não caiu em nenhuma seção acima, mostra formatado */}
          {parsed.criteria.length === 0 &&
            parsed.lineErrors.length === 0 &&
            parsed.paragraphAnalysis.length === 0 && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {parsed.rawText || reportText}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default function DiscursivasIAPage() {
  const { stats, selectedDataFile } = useData();
  const { showNotification } = useNotification();

  // Modalidade e Banca
  const [modality, setModality] = useState<DiscursiveModality>('redacao');
  const [banca, setBanca] = useState<string>('cebraspe');
  const [cargoTarget, setCargoTarget] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  // Regras do Edital + Instruções da IA
  const [rawEditalExcerpt, setRawEditalExcerpt] = useState<string>('');
  const [editalRule, setEditalRule] = useState<string>(BANCA_PROFILES.cebraspe.defaultRule);
  const [editalAiGuidance, setEditalAiGuidance] = useState<string>('');
  const [maxScore, setMaxScore] = useState<number>(100);
  const [minLines, setMinLines] = useState<number>(20);
  const [maxLines, setMaxLines] = useState<number>(30);
  const [isConfigExpanded, setIsConfigExpanded] = useState<boolean>(false);

  // Tema / Proposta / Espelho
  const [themeTitle, setThemeTitle] = useState<string>('');
  const [themePromptText, setThemePromptText] = useState<string>('');
  const [officialRubricText, setOfficialRubricText] = useState<string>('');
  const [showRubric, setShowRubric] = useState<boolean>(false);
  const [previousThemesSuggestions, setPreviousThemesSuggestions] = useState<string>('');

  // Folha de Resposta (Digitada ou Foto Manuscrita)
  const [inputMode, setInputMode] = useState<'typed' | 'handwritten'>('typed');
  const [studentEssay, setStudentEssay] = useState<string>('');
  const [handwrittenPhotoDataUrl, setHandwrittenPhotoDataUrl] = useState<string | null>(null);

  // Cronômetro local de treino de redação
  const [essayTimerSec, setEssayTimerSec] = useState<number>(0);
  const [isEssayTimerRunning, setIsEssayTimerRunning] = useState<boolean>(false);

  // Resultado da Correção e Histórico
  const [aiCorrectionReport, setAiCorrectionReport] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<SavedEssayEvaluation[]>([]);
  const [isAiKeyModalOpen, setIsAiKeyModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const subjectsList = useMemo(() => stats?.editalData || [], [stats?.editalData]);
  const topicsForSelectedSubject = useMemo(() => {
    const subj = subjectsList.find((s) => s.subject === selectedSubject);
    if (!subj) return [];
    const flatten = (list: any[]): string[] => {
      let out: string[] = [];
      for (const t of list || []) {
        if (t.topic_text) out.push(t.topic_text);
        if (t.sub_topics && t.sub_topics.length > 0) {
          out = out.concat(flatten(t.sub_topics));
        }
      }
      return out;
    };
    return flatten(subj.topics || []);
  }, [subjectsList, selectedSubject]);

  // Inteligência Histórica: Evolução de Notas & Radar de Erros Constantes
  const historicalIntel = useMemo(
    () => buildHistoricalIntelligence(historyList),
    [historyList]
  );

  // Carrega configurações e histórico salvos
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedCfg = localStorage.getItem(`krono_discursivas_cfg_${selectedDataFile || 'default'}`);
      if (savedCfg) {
        const parsed = JSON.parse(savedCfg);
        if (parsed.banca) setBanca(parsed.banca);
        if (parsed.editalRule) setEditalRule(parsed.editalRule);
        if (parsed.editalAiGuidance) setEditalAiGuidance(parsed.editalAiGuidance);
        if (parsed.maxScore) setMaxScore(Number(parsed.maxScore));
        if (parsed.minLines) setMinLines(Number(parsed.minLines));
        if (parsed.maxLines) setMaxLines(Number(parsed.maxLines));
        if (parsed.cargoTarget) setCargoTarget(parsed.cargoTarget);
      }
      const savedHist = localStorage.getItem(`krono_discursivas_hist_${selectedDataFile || 'default'}`);
      if (savedHist) {
        const parsedHist = JSON.parse(savedHist);
        if (Array.isArray(parsedHist)) {
          setHistoryList(parsedHist);
          if (parsedHist.length > 0 && !aiCorrectionReport) {
            setAiCorrectionReport(parsedHist[0].correctionReport);
          }
        }
      }
    } catch {}
  }, [selectedDataFile]);

  const saveConfigToStorage = (overrides?: Record<string, any>) => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        banca,
        editalRule,
        editalAiGuidance,
        maxScore,
        minLines,
        maxLines,
        cargoTarget,
        ...overrides,
      };
      localStorage.setItem(
        `krono_discursivas_cfg_${selectedDataFile || 'default'}`,
        JSON.stringify(payload)
      );
    } catch {}
  };

  // Cronômetro da Redação
  useEffect(() => {
    if (!isEssayTimerRunning) return;
    const interval = setInterval(() => {
      setEssayTimerSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isEssayTimerRunning]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Divide o texto do aluno em linhas numeradas (estimando ~82 caracteres por linha de folha oficial ou quebras explícitas)
  const numberedLinesPreview = useMemo(() => {
    if (!studentEssay.trim()) return [];
    const paragraphs = studentEssay.split('\n');
    const lines: string[] = [];
    const CHARS_PER_LINE = 82;
    for (const p of paragraphs) {
      if (!p.trim()) {
        lines.push('');
        continue;
      }
      let remaining = p;
      while (remaining.length > CHARS_PER_LINE) {
        let cutIdx = remaining.lastIndexOf(' ', CHARS_PER_LINE);
        if (cutIdx <= 20) cutIdx = CHARS_PER_LINE;
        lines.push(remaining.slice(0, cutIdx));
        remaining = remaining.slice(cutIdx).trimStart();
      }
      if (remaining.length > 0) {
        lines.push(remaining);
      }
    }
    return lines;
  }, [studentEssay]);

  // 1. Ler Edital com IA e configurar método de correção + instruções ao candidato
  const handleAnalyzeEditalWithAi = async () => {
    if (!rawEditalExcerpt.trim()) {
      showNotification('Cole o trecho do seu edital que fala sobre a prova discursiva ou redação.', 'warning');
      return;
    }
    setIsLoadingAi('edital');
    try {
      const res = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt:
            'Você é um coordenador de banca examinadora especialista em editais de concursos públicos brasileiros. Responda em JSON puro válido sem blocos markdown.',
          userPrompt: `Analise o seguinte trecho de edital sobre a Prova Discursiva / Redação e extraia exatamente um objeto JSON com as chaves:
{
  "bancaDetectada": "nome da banca (ex: cebraspe, fgv, fcc, vunesp, cesgranrio ou personalizada)",
  "maxScore": numero_da_nota_maxima (ex: 100 ou 20 ou 10),
  "minLines": numero_minimo_de_linhas (ex: 20),
  "maxLines": numero_maximo_de_linhas (ex: 30),
  "formulaOuRegraDeCorrecao": "resumo técnico exato de como a nota é calculada, pesos de conteúdo vs gramática e descontos por erro/linha segundo este edital",
  "guiaParaOAluno": "instrução prática em tópicos explicando ao candidato exatamente como ele deve estruturar seu texto, o que fazer e o que evitar para tirar nota máxima segundo este edital"
}

TRECHO DO EDITAL:
${rawEditalExcerpt}`,
          temperature: 0.15,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showNotification(data.error || 'Erro ao analisar o edital com a IA.', 'error');
        return;
      }
      const cleaned = String(data.content || '')
        .replace(/```json|```/g, '')
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        const nextRule = parsed.formulaOuRegraDeCorrecao || editalRule;
        const nextGuide = parsed.guiaParaOAluno || '';
        const nextMaxScore = Number(parsed.maxScore) || 100;
        const nextMinLines = Number(parsed.minLines) || 20;
        const nextMaxLines = Number(parsed.maxLines) || 30;

        setEditalRule(nextRule);
        setEditalAiGuidance(nextGuide);
        setMaxScore(nextMaxScore);
        setMinLines(nextMinLines);
        setMaxLines(nextMaxLines);
        setBanca('personalizada');

        saveConfigToStorage({
          banca: 'personalizada',
          editalRule: nextRule,
          editalAiGuidance: nextGuide,
          maxScore: nextMaxScore,
          minLines: nextMinLines,
          maxLines: nextMaxLines,
        });
        showNotification('Edital analisado! As regras de correção e o seu Guia Estratégico foram configurados.', 'success');
      } catch {
        setEditalRule(cleaned);
        setEditalAiGuidance(cleaned);
        saveConfigToStorage({ editalRule: cleaned, editalAiGuidance: cleaned });
        showNotification('Regras do edital extraídas pela IA com sucesso!', 'success');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro de conexão com a IA.', 'error');
    } finally {
      setIsLoadingAi(null);
    }
  };

  // 2. Pesquisar Temas Anteriores da Banca com IA
  const handleSearchPreviousBancaThemes = async () => {
    setIsLoadingAi('search_themes');
    try {
      const profile = BANCA_PROFILES[banca] || BANCA_PROFILES.cebraspe;
      const modalityLabel =
        modality === 'redacao'
          ? 'Redação Dissertativo-Argumentativa (Temas Gerais / Atualidades / Segurança / Administração / Sociedade)'
          : modality === 'questao_discursiva'
          ? `Questão Discursiva / Estudo de Caso (${selectedSubject || 'Conhecimentos Específicos'}${
              selectedTopic ? ` - ${selectedTopic}` : ''
            })`
          : `Peça Prática / Parecer Técnico (${selectedSubject || 'Área Específica'})`;

      const res = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt:
            'Você é um professor especialista em provas discursivas e redações de concursos públicos brasileiros.',
          userPrompt: `Liste 6 TEMAS REAIS OU CLÁSSICOS cobrados recentemente pela banca ${profile.label} (ou altamente prováveis para o perfil desta banca) na modalidade: ${modalityLabel}${
            cargoTarget ? ` para o cargo/área de ${cargoTarget}` : ''
          }.
Para cada tema, apresente:
- **Título do Tema / Comando**
- **Ano / Órgão de referência (ou Tendência da Banca)**
- **O que a banca exigiu no espelho de correção (1 linha resumida)**`,
          temperature: 0.4,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showNotification(data.error || 'Falha ao buscar temas da banca.', 'error');
      } else if (data.content) {
        setPreviousThemesSuggestions(data.content);
        showNotification('Temas da banca pesquisados com sucesso!', 'success');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao pesquisar temas.', 'error');
    } finally {
      setIsLoadingAi(null);
    }
  };

  // 3. Gerar Proposta Completa + Textos Motivadores + Espelho Oficial com IA
  const handleGenerateFullPromptWithAi = async () => {
    setIsLoadingAi('generate_prompt');
    try {
      const profile = BANCA_PROFILES[banca] || BANCA_PROFILES.cebraspe;
      const modalityDesc =
        modality === 'redacao'
          ? 'REDAÇÃO DISSERTATIVO-ARGUMENTATIVA de Concurso Público'
          : modality === 'questao_discursiva'
          ? `QUESTÃO DISCURSIVA / ESTUDO DE CASO sobre a disciplina "${selectedSubject || 'Direito / Específicas'}" e tópico "${selectedTopic || 'Geral'}"`
          : `PEÇA PRÁTICA / PARECER TÉCNICO sobre "${selectedSubject || 'Prática Profissional'}"`;

      const res = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: `Você é um examinador sênior da banca ${profile.label}.`,
          userPrompt: `Elabore uma proposta oficial completa de ${modalityDesc}${
            themeTitle ? ` sobre o tema específico: "${themeTitle}"` : ''
          }${cargoTarget ? ` voltada para o cargo de ${cargoTarget}` : ''}.
- Limite de linhas: de ${minLines} a ${maxLines} linhas.
- Nota Máxima: ${maxScore} pontos.
- Regra do Edital: ${editalRule}

Separe sua resposta EXATAMENTE em duas partes usando o marcador ===ESPELHO_OFICIAL=== no meio:
Na Parte 1 (antes de ===ESPELHO_OFICIAL===), escreva:
- **TEXTO(S) MOTIVADOR(ES) / SITUAÇÃO-PROBLEMA**
- **TEMA E COMANDO DA PROPOSTA (com os quesitos A, B, C e a pontuação de cada quesito)**.

Na Parte 2 (depois de ===ESPELHO_OFICIAL===), escreva:
- **ESPELHO OFICIAL DE CORREÇÃO (PADRÃO DE RESPOSTA DA BANCA)**: o que o candidato precisa abordar em cada parágrafo/quesito, repertório ou fundamentação legal/jurisprudencial esperada para gabaritar.`,
          temperature: 0.45,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showNotification(data.error || 'Erro ao gerar proposta com IA.', 'error');
      } else if (data.content) {
        const parts = String(data.content).split('===ESPELHO_OFICIAL===');
        setThemePromptText(parts[0]?.trim() || data.content);
        setOfficialRubricText(parts[1]?.trim() || '');
        setShowRubric(false);
        showNotification(
          'Proposta gerada! O Espelho Oficial ficou oculto para você consultar só depois de escrever.',
          'success'
        );
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro de conexão com a IA.', 'error');
    } finally {
      setIsLoadingAi(null);
    }
  };

  // 4. Corrigir Redação / Discursiva Linha a Linha com IA (Retornando JSON Estruturado + Comparativo Histórico)
  const handleEvaluateEssayWithAi = async () => {
    if (inputMode === 'typed' && !studentEssay.trim()) {
      showNotification('Digite sua redação/resposta na folha antes de pedir a correção.', 'warning');
      return;
    }
    if (inputMode === 'handwritten' && !handwrittenPhotoDataUrl && !studentEssay.trim()) {
      showNotification('Anexe a foto da sua folha manuscrita ou insira a transcrição.', 'warning');
      return;
    }

    setIsLoadingAi('evaluate');
    try {
      const profile = BANCA_PROFILES[banca] || BANCA_PROFILES.cebraspe;
      const totalWrittenLines = numberedLinesPreview.length || 1;
      const formattedNumberedEssay =
        numberedLinesPreview.length > 0
          ? numberedLinesPreview
              .map((line, idx) => `Linha ${String(idx + 1).padStart(2, '0')}: ${line}`)
              .join('\n')
          : studentEssay;

      const prompt = `Você é o examinador oficial da banca ${profile.label}. Realize uma CORREÇÃO RIGOROSA LINHA A LINHA desta ${
        modality === 'redacao'
          ? 'Redação Dissertativo-Argumentativa'
          : modality === 'questao_discursiva'
          ? 'Questão Discursiva'
          : 'Peça Prática'
      }.

DADOS E REGRAS DO EDITAL DO ALUNO:
- Banca / Estilo: ${profile.label} (${profile.description})
- Regra de Cálculo e Critérios do Edital: ${editalRule}
- Nota Máxima: ${maxScore} pontos | Mínimo de linhas: ${minLines} | Máximo de linhas: ${maxLines}
- Total de linhas efetivamente escritas pelo candidato (TL): ${totalWrittenLines} linhas
${themeTitle ? `- Tema: ${themeTitle}\n` : ''}${
        themePromptText ? `- Proposta / Quesitos:\n${themePromptText}\n` : ''
      }${officialRubricText ? `- Espelho de Referência:\n${officialRubricText}\n` : ''}
${historicalIntel.promptContextForAi ? `\n${historicalIntel.promptContextForAi}\n` : ''}

TEXTO DO CANDIDATO NUMERADO LINHA A LINHA:
${formattedNumberedEssay}

Responda EXCLUSIVAMENTE com um objeto JSON válido (sem blocos markdown \`\`\`json) seguindo exatamente esta estrutura para renderização no painel visual:
{
  "contentScore": numero_da_nota_de_conteudo_NC,
  "maxScore": ${maxScore},
  "totalLines": ${totalWrittenLines},
  "grammarErrorsCount": numero_total_de_erros_gramaticais_NE,
  "grammarDeduction": valor_numerico_do_desconto_gramatical,
  "finalNetScore": nota_final_liquida_NF,
  "formulaSummary": "ex: NF = 86,00 - (2 × 11 / 29) = 85,24 pontos",
  "historicalComparison": {
    "summary": "Síntese comparando o desempenho atual com o histórico anterior do aluno (se houver)",
    "improvedPoints": ["Ponto em que o aluno evoluiu em relação às redações passadas"],
    "recurringAlerts": ["Erro constante/recorrente que voltou a aparecer neste texto"]
  },
  "criteria": [
    {
      "title": "Nome do Quesito (ex: 1. Apresentação e Estrutura Textual ou Quesito 2.1 - Papel da PRF)",
      "max": valor_maximo_do_quesito,
      "obtained": nota_obtida_pelo_aluno,
      "feedback": "Explicação objetiva do que acertou e do que faltou para gabaritar o quesito"
    }
  ],
  "lineErrors": [
    {
      "line": "Linha 01",
      "category": "Propriedade Vocabular | Pontuação / Vírgula | Regência & Crase | Concordância | Coesão & Repetição | Ortografia & Acentuação | Morfossintaxe & Nexo",
      "original": "trecho exato com desvio",
      "correction": "trecho corrigido",
      "explanation": "explicação gramatical direta e didática"
    }
  ],
  "paragraphAnalysis": [
    {
      "paragraph": "1º Parágrafo (Introdução / Quesito 1)",
      "strengths": "O que ficou bem construído neste parágrafo",
      "improvements": "Como aprofundar o repertório ou nexo causal neste parágrafo"
    }
  ],
  "actionPlan": [
    "Foco prioritário 1 para a próxima redação",
    "Foco prioritário 2 para a próxima redação",
    "Foco prioritário 3 para a próxima redação"
  ],
  "modelRewrite": "Reescrita completa da redação (4 parágrafos) no padrão nota máxima da banca ${profile.label}, mantendo a essência dos argumentos do aluno mas com vocabulário técnico, coesão e subsunção perfeitos."
}`;

      const res = await fetch('/api/ai/deepseek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt:
            'Você é um examinador oficial de provas discursivas e redações de concursos públicos. Responda sempre em JSON puro e válido seguindo a estrutura solicitada.',
          userPrompt: prompt,
          temperature: 0.2,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showNotification(data.error || 'Erro ao corrigir redação com a IA.', 'error');
      } else if (data.content) {
        setAiCorrectionReport(data.content);
        setIsEssayTimerRunning(false);

        const newEntry: SavedEssayEvaluation = {
          id: `${Date.now()}`,
          date: new Date().toLocaleDateString('pt-BR'),
          modality,
          banca: BANCA_PROFILES[banca]?.label || banca,
          subjectName: selectedSubject || undefined,
          topicName: selectedTopic || undefined,
          themeTitle: themeTitle || (themePromptText ? themePromptText.slice(0, 80) + '...' : 'Tema Livre'),
          studentEssay,
          correctionReport: data.content,
        };
        const updatedHist = [newEntry, ...historyList].slice(0, 30);
        setHistoryList(updatedHist);
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            `krono_discursivas_hist_${selectedDataFile || 'default'}`,
            JSON.stringify(updatedHist)
          );
        }
        showNotification('Laudo Oficial de Correção concluído e salvo no seu histórico!', 'success');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro de conexão com a IA.', 'error');
    } finally {
      setIsLoadingAi(null);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHandwrittenPhotoDataUrl(ev.target?.result as string);
      showNotification(
        'Foto da redação manuscrita anexada! Digite ou revise a transcrição ao lado para a correção linha a linha.',
        'success'
      );
    };
    reader.readAsDataURL(file);
  };

  const activeBancaProfile = BANCA_PROFILES[banca] || BANCA_PROFILES.cebraspe;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm print:hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Award size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Laboratório de Redação & Discursivas com IA
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Correção estruturada linha a linha, adaptação automática às regras do seu edital e radar de evolução histórica
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsConfigExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 text-xs font-extrabold transition-all shadow-sm"
          >
            <Sliders size={14} />
            {isConfigExpanded ? 'Ocultar Leitor de Edital' : '📜 Meu Edital é Diferente? Configurar c/ IA'}
          </button>

          <button
            type="button"
            onClick={() => setIsAiKeyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-all"
          >
            <KeyRound size={14} />
            Chave de IA (Criptografada)
          </button>
        </div>
      </div>

      {/* Painel de Evolução & Radar de Erros Constantes (exibido assim que houver 1+ redações no histórico) */}
      {historyList.length > 0 && (
        <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-5 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <TrendingUp size={17} className="text-emerald-400" /> Inteligência de Evolução & Radar de Erros Constantes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O sistema analisa todas as suas {historyList.length} redações corrigidas, mapeia seus vícios recorrentes e envia esse histórico para a IA cobrar sua evolução na próxima redação!
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs">
                <span className="text-slate-400 mr-1">Média:</span>
                <strong className="text-slate-900 dark:text-white">
                  {historicalIntel.averageScore.toFixed(2).replace('.', ',')} pts
                </strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                <span className="text-emerald-400 mr-1">Recorde:</span>
                <strong className="text-emerald-400">
                  {historicalIntel.bestScore.toFixed(2).replace('.', ',')} pts
                </strong>
              </div>
              {historicalIntel.timeline.length >= 2 && (
                <div
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    historicalIntel.scoreDelta >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {historicalIntel.scoreDelta >= 0 ? '+' : ''}
                  {historicalIntel.scoreDelta.toFixed(2).replace('.', ',')} pts desde a 1ª
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Linha do Tempo de Notas */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                📈 Curva de Evolução das Notas ({historicalIntel.timeline.length} treinos)
              </span>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {historicalIntel.timeline.map((t) => (
                  <div key={t.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[230px]">
                        #{t.index} • {t.date} — {t.themeTitle}
                      </span>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        {t.finalNetScore.toFixed(2).replace('.', ',')} / {t.maxScore}{' '}
                        <span className="text-[10px] text-slate-400">({t.errorsCount} erros)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(8, t.normalizedPct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar de Erros Constantes / Recorrentes */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Radar de Vícios & Erros Mais Recorrentes
              </span>
              {historicalIntel.recurringCategories.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Corrija suas redações para mapearmos automaticamente os seus padrões de erro.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {historicalIntel.recurringCategories.map((cat, idx) => (
                    <div
                      key={cat.category}
                      className="p-2.5 rounded-lg bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-amber-500' : 'bg-indigo-400'
                            }`}
                          />
                          {cat.category}
                        </span>
                        <span className="text-[11px] font-extrabold text-amber-400">
                          {cat.count} ocorrência{cat.count > 1 ? 's' : ''} ({cat.percentage}%)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {cat.advice}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seção Expansível: Leitor de Edital com IA (Extrai Regras + Guia Estratégico) */}
      {isConfigExpanded && (
        <div className="p-6 rounded-2xl bg-indigo-500/[0.06] border-2 border-indigo-500/40 space-y-4 animate-fadeIn print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <Sparkles size={16} /> Configurar Correção Lendo o Seu Edital com IA
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                O seu edital tem pontuação diferente (ex: vale 20 ou 30 pontos) ou critérios específicos? Cole abaixo o item do edital sobre a Prova Discursiva. A IA vai atualizar a fórmula automaticamente!
              </p>
            </div>
          </div>

          <textarea
            value={rawEditalExcerpt}
            onChange={(e) => setRawEditalExcerpt(e.target.value)}
            rows={5}
            placeholder="Cole aqui o trecho do seu edital (ex: '9. DA PROVA DISCURSIVA: A prova discursiva valerá 20,00 pontos e consistirá da redação de texto dissertativo, de até 30 linhas, aplicando-se a fórmula NF = NC - 4 × (NE / TL)...')"
            className="w-full p-3.5 rounded-xl bg-white dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAnalyzeEditalWithAi}
              disabled={isLoadingAi !== null}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all"
            >
              <Sparkles size={15} />
              {isLoadingAi === 'edital'
                ? 'Lendo Edital e Extraindo Critérios...'
                : '🤖 Ler Edital com IA e Atualizar Critérios'}
            </button>
          </div>
        </div>
      )}

      {/* Guia Estratégico Personalizado da IA (se já extraído do edital) */}
      {editalAiGuidance && (
        <div className="p-5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/30 space-y-2 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Instruções da IA Baseadas no Seu Edital (Como Estruturar Sua Prova)
            </span>
            <button
              type="button"
              onClick={() => {
                setEditalAiGuidance('');
                saveConfigToStorage({ editalAiGuidance: '' });
              }}
              className="text-[11px] text-slate-400 hover:text-rose-400"
            >
              Limpar guia
            </button>
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {editalAiGuidance}
          </div>
        </div>
      )}

      {/* Passo 1: Escolha da Modalidade, Banca e Parâmetros */}
      <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-5 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'redacao',
              title: '📝 Redação Dissertativa',
              desc: 'Temas gerais, atualidades, segurança pública, sociedade e reflexões',
            },
            {
              id: 'questao_discursiva',
              title: '⚖️ Questão Discursiva / Caso',
              desc: 'Questões abertas ou estudos de caso de matérias específicas do edital',
            },
            {
              id: 'peca_pratica',
              title: '🏛️ Peça Prática / Parecer',
              desc: 'Peças jurídicas, pareceres técnicos, relatórios e peças policiais',
            },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModality(m.id as DiscursiveModality)}
              className={`p-4 rounded-xl border text-left transition-all ${
                modality === m.id
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-[#0b1320] border-slate-200 dark:border-[#1f304a] text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="text-sm font-bold block">{m.title}</span>
              <span className="text-[11px] opacity-80 block mt-0.5">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Banca Examinadora
            </label>
            <select
              value={banca}
              onChange={(e) => {
                const nextB = e.target.value;
                setBanca(nextB);
                if (BANCA_PROFILES[nextB] && nextB !== 'personalizada') {
                  setEditalRule(BANCA_PROFILES[nextB].defaultRule);
                  setMaxScore(BANCA_PROFILES[nextB].defaultMaxScore);
                  setMaxLines(BANCA_PROFILES[nextB].defaultLines);
                  saveConfigToStorage({
                    banca: nextB,
                    editalRule: BANCA_PROFILES[nextB].defaultRule,
                  });
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-semibold text-slate-800 dark:text-white"
            >
              {Object.entries(BANCA_PROFILES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Cargo / Área (Opcional)
            </label>
            <input
              type="text"
              value={cargoTarget}
              onChange={(e) => {
                setCargoTarget(e.target.value);
                saveConfigToStorage({ cargoTarget: e.target.value });
              }}
              placeholder="Ex: PRF, Analista Judiciário, Auditor..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-white"
            />
          </div>

          <div className="md:col-span-5 grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Nota Máx.
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={(e) => {
                  const v = Number(e.target.value) || 100;
                  setMaxScore(v);
                  saveConfigToStorage({ maxScore: v });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Mín. Linhas
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={minLines}
                onChange={(e) => {
                  const v = Number(e.target.value) || 20;
                  setMinLines(v);
                  saveConfigToStorage({ minLines: v });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Máx. Linhas
              </label>
              <input
                type="number"
                min={10}
                max={150}
                value={maxLines}
                onChange={(e) => {
                  const v = Number(e.target.value) || 30;
                  setMaxLines(v);
                  saveConfigToStorage({ maxLines: v });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-bold text-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Explicação transparente de onde vêm os critérios da banca + atalho de personalização */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-white">
                De onde vêm esses critérios ({activeBancaProfile.label}):
              </strong>{' '}
              {activeBancaProfile.originExplanation}
            </div>
          </div>
          {!isConfigExpanded && (
            <button
              type="button"
              onClick={() => setIsConfigExpanded(true)}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-[11px] font-bold transition-all"
            >
              Colar Meu Edital <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Se for Questão Discursiva ou Peça Prática, permite vincular Disciplina e Tópico do Edital */}
        {modality !== 'redacao' && subjectsList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Disciplina do Edital
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedTopic('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-white"
              >
                <option value="">Todas / Geral</option>
                {subjectsList.map((s) => (
                  <option key={s.subject} value={s.subject}>
                    {s.subject}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tópico Específico (Opcional)
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-800 dark:text-white"
              >
                <option value="">Qualquer tópico da disciplina</option>
                {topicsForSelectedSubject.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Fórmula / Critérios de Correção Ativos (Você pode editar manualmente aqui a qualquer momento)
          </label>
          <input
            type="text"
            value={editalRule}
            onChange={(e) => {
              setEditalRule(e.target.value);
              saveConfigToStorage({ editalRule: e.target.value });
            }}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-700 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Passo 2: Tema da Redação / Enunciado + Pesquisa de Temas da Banca */}
      <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen size={16} className="text-emerald-500" /> Tema da Redação / Enunciado da Questão
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digite o seu tema (mesmo sem textos motivadores), pesquise temas já cobrados pela banca ou gere uma proposta completa
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSearchPreviousBancaThemes}
              disabled={isLoadingAi !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#0b1320] hover:bg-indigo-500/15 text-slate-700 dark:text-slate-200 hover:text-indigo-400 border border-slate-200 dark:border-[#1f304a] text-xs font-bold transition-all"
            >
              <Search size={14} />
              {isLoadingAi === 'search_themes'
                ? 'Pesquisando temas da banca...'
                : '🔎 Pesquisar Temas Cobrados pela Banca'}
            </button>

            <button
              type="button"
              onClick={handleGenerateFullPromptWithAi}
              disabled={isLoadingAi !== null}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles size={14} />
              {isLoadingAi === 'generate_prompt'
                ? 'Gerando Proposta e Espelho...'
                : '⚡ Gerar Proposta + Espelho com IA'}
            </button>
          </div>
        </div>

        {/* Lista de Temas Cobrados pela Banca (se pesquisado) */}
        {previousThemesSuggestions && (
          <div className="p-4 rounded-xl bg-indigo-500/[0.05] border border-indigo-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400">
                📚 Temas Anteriores e Tendências da Banca ({activeBancaProfile.label})
              </span>
              <button
                type="button"
                onClick={() => setPreviousThemesSuggestions('')}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Fechar lista
              </button>
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {previousThemesSuggestions}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={themeTitle}
            onChange={(e) => setThemeTitle(e.target.value)}
            placeholder="Título do Tema (ex: Os desafios da segurança viária e o enfrentamento aos crimes transfronteiriços no Brasil)..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs font-semibold text-slate-800 dark:text-white"
          />

          <textarea
            value={themePromptText}
            onChange={(e) => setThemePromptText(e.target.value)}
            rows={4}
            placeholder="(Opcional) Cole ou gere aqui os Textos Motivadores e os Quesitos A, B e C da prova..."
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
          />

          {officialRubricText && (
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/25">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  🎯 Espelho Oficial de Correção da Banca
                </span>
                <button
                  type="button"
                  onClick={() => setShowRubric((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
                >
                  {showRubric ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showRubric ? 'Ocultar Espelho' : 'Revelar Espelho Oficial'}
                </button>
              </div>
              {showRubric && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {officialRubricText}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Passo 3: Folha Oficial Numerada Linha a Linha + Cronômetro de Prova */}
      <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode('typed')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                inputMode === 'typed'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-[#0b1320] text-slate-500'
              }`}
            >
              <PenTool size={14} />
              Digitar na Folha Numerada
            </button>
            <button
              type="button"
              onClick={() => setInputMode('handwritten')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                inputMode === 'handwritten'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-[#0b1320] text-slate-500'
              }`}
            >
              <ImageIcon size={14} />
              Foto da Folha Escrita à Mão
            </button>
          </div>

          {/* Cronômetro de Prova Discursiva + Contador de Linhas */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a]">
              <Clock size={14} className="text-emerald-500" />
              <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                {formatTimer(essayTimerSec)}
              </span>
              <button
                type="button"
                onClick={() => setIsEssayTimerRunning((v) => !v)}
                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500"
                title={isEssayTimerRunning ? 'Pausar tempo de redação' : 'Iniciar tempo de redação'}
              >
                {isEssayTimerRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEssayTimerRunning(false);
                  setEssayTimerSec(0);
                }}
                className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                title="Zerar tempo"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                numberedLinesPreview.length > maxLines
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : numberedLinesPreview.length >= minLines
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {numberedLinesPreview.length} / {maxLines} linhas (mín. {minLines})
            </span>
          </div>
        </div>

        {inputMode === 'handwritten' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#1f304a] bg-slate-50 dark:bg-[#0b1320] hover:border-emerald-500/50 cursor-pointer transition-colors min-h-[220px]">
              <ImageIcon size={28} className="text-emerald-500 mb-2" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center">
                Clique para enviar a foto da sua Redação Escrita à Mão
              </span>
              <span className="text-[11px] text-slate-400 text-center mt-1">
                Suporta JPG, PNG ou WebP
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            {handwrittenPhotoDataUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#1f304a] bg-black/40 max-h-64 flex items-center justify-center">
                <img
                  src={handwrittenPhotoDataUrl}
                  alt="Folha Manuscrita"
                  className="max-h-60 object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Editor Lado a Lado com Folha Oficial Numerada (1 a maxLines) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Digite seu texto aqui (quebra automática na Folha Oficial ao lado)
            </label>
            <textarea
              value={studentEssay}
              onChange={(e) => setStudentEssay(e.target.value)}
              rows={14}
              placeholder="Escreva sua redação ou resposta discursiva aqui..."
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0b1320] border border-slate-200 dark:border-[#1f304a] text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Folha Oficial Numerada da Banca (Visualização Linha a Linha)
            </label>
            <div className="rounded-xl border border-slate-200 dark:border-[#1f304a] bg-white dark:bg-[#090f1a] p-3 max-h-[345px] overflow-y-auto font-mono text-xs">
              {Array.from({ length: Math.max(maxLines, numberedLinesPreview.length) }).map(
                (_, idx) => {
                  const lineNum = idx + 1;
                  const lineContent = numberedLinesPreview[idx] || '';
                  const isOverLimit = lineNum > maxLines;
                  return (
                    <div
                      key={lineNum}
                      className={`flex items-baseline gap-2.5 py-1 border-b border-slate-100 dark:border-[#152238] ${
                        isOverLimit ? 'bg-rose-500/10 text-rose-400' : ''
                      }`}
                    >
                      <span className="w-6 text-right text-[10px] font-bold text-slate-400 select-none shrink-0">
                        {String(lineNum).padStart(2, '0')}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all">
                        {lineContent || ' '}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleEvaluateEssayWithAi}
            disabled={isLoadingAi !== null}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Sparkles size={16} />
            {isLoadingAi === 'evaluate'
              ? 'Corrigindo Linha a Linha e Comparando Evolução (aguarde ~15s)...'
              : `⚡ Corrigir Agora no Padrão ${activeBancaProfile.label}`}
          </button>
        </div>
      </div>

      {/* Laudo Oficial de Correção da IA (Painel Visual Estruturado) */}
      {aiCorrectionReport && (
        <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border-2 border-emerald-500/40 shadow-lg animate-fadeIn">
          <VisualCorrectionReportCard
            reportText={aiCorrectionReport}
            bancaLabel={activeBancaProfile.label}
            defaultMaxScore={maxScore}
            defaultLines={numberedLinesPreview.length || 29}
            copied={copiedId === 'current'}
            onCopyRaw={() => {
              navigator.clipboard.writeText(aiCorrectionReport);
              setCopiedId('current');
              setTimeout(() => setCopiedId(null), 2000);
            }}
          />
        </div>
      )}

      {/* Histórico de Redações e Discursivas Corrigidas */}
      {historyList.length > 0 && (
        <div className="bg-white dark:bg-[#131f33] p-6 rounded-2xl border border-slate-200 dark:border-[#1f304a] shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <History size={16} className="text-indigo-400" /> Histórico Completo de Textos Corrigidos ({historyList.length})
            </h3>
          </div>
          <div className="space-y-3">
            {historyList.map((item) => {
              const itemParsed = parseDiscursiveReport(item.correctionReport);
              return (
                <details
                  key={item.id}
                  className="group rounded-xl border border-slate-200 dark:border-[#1f304a] bg-slate-50 dark:bg-[#0b1320] p-4"
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                        {item.date} • {item.banca} •{' '}
                        {item.modality === 'redacao'
                          ? 'Redação'
                          : item.modality === 'questao_discursiva'
                          ? 'Questão Discursiva'
                          : 'Peça Prática'}
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">
                        {item.themeTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-extrabold text-emerald-400">
                        NF: {itemParsed.finalNetScore.toFixed(2).replace('.', ',')} / {itemParsed.maxScore}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setStudentEssay(item.studentEssay);
                          setThemeTitle(item.themeTitle);
                          setAiCorrectionReport(item.correctionReport);
                          window.scrollTo({ top: 400, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-[11px] font-bold"
                        title="Abrir este laudo no Painel Principal"
                      >
                        Abrir no Painel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          const next = historyList.filter((h) => h.id !== item.id);
                          setHistoryList(next);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem(
                              `krono_discursivas_hist_${selectedDataFile || 'default'}`,
                              JSON.stringify(next)
                            );
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                        title="Excluir do histórico"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#1f304a] space-y-5">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-[#131f33] border border-slate-200 dark:border-[#1f304a] text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      <strong className="text-indigo-400 block mb-1">Seu Texto Original:</strong>
                      {item.studentEssay}
                    </div>
                    <VisualCorrectionReportCard
                      reportText={item.correctionReport}
                      bancaLabel={item.banca}
                      defaultMaxScore={itemParsed.maxScore || 100}
                      defaultLines={itemParsed.totalLines || 29}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      <UserAiKeyModal isOpen={isAiKeyModalOpen} onClose={() => setIsAiKeyModalOpen(false)} />
    </div>
  );
}
