export interface CriterionEvaluation {
  title: string;
  obtained: number;
  max: number;
  deduction: number;
  feedback: string;
}

export interface LineErrorItem {
  line: string;
  category: string;
  original: string;
  correction: string;
  explanation: string;
}

export interface ParagraphAnalysisItem {
  paragraph: string;
  strengths: string;
  improvements: string;
}

export interface StructuredDiscursiveReport {
  contentScore: number; // NC
  maxScore: number;
  totalLines: number; // TL
  grammarErrorsCount: number; // NE
  grammarDeduction: number;
  finalNetScore: number; // NF
  formulaSummary: string;
  historicalComparison?: {
    improvedPoints: string[];
    recurringAlerts: string[];
    summary: string;
  };
  criteria: CriterionEvaluation[];
  lineErrors: LineErrorItem[];
  paragraphAnalysis: ParagraphAnalysisItem[];
  actionPlan: string[];
  modelRewrite: string;
  rawText?: string;
}

export interface RecurringCategoryStat {
  category: string;
  count: number;
  percentage: number;
  advice: string;
}

function parsePtNumber(val: any, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (!val) return fallback;
  const cleaned = String(val)
    .replace(/\s/g, '')
    .replace(',', '.');
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : fallback;
}

export function categorizeErrorText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('vocabular') || lower.includes('coloquial') || lower.includes('imprecis') || lower.includes('semântic') || lower.includes('semantic')) {
    return 'Propriedade Vocabular';
  }
  if (lower.includes('vírgula') || lower.includes('virgula') || lower.includes('pontuação') || lower.includes('pontuacao')) {
    return 'Pontuação / Vírgula';
  }
  if (lower.includes('regência') || lower.includes('regencia') || lower.includes('crase') || lower.includes('preposição')) {
    return 'Regência & Crase';
  }
  if (lower.includes('concordância') || lower.includes('concordancia') || lower.includes('plural') || lower.includes('singular')) {
    return 'Concordância';
  }
  if (lower.includes('repeti') || lower.includes('coesão') || lower.includes('coesao') || lower.includes('conectiv')) {
    return 'Coesão & Repetição';
  }
  if (lower.includes('ortograf') || lower.includes('acento') || lower.includes('acentuação') || lower.includes('grafia') || lower.includes('hífen')) {
    return 'Ortografia & Acentuação';
  }
  if (lower.includes('paralelismo') || lower.includes('sintax') || lower.includes('morfossintax') || lower.includes('truncad') || lower.includes('nexo')) {
    return 'Morfossintaxe & Nexo';
  }
  return 'Norma Culta / Gramática';
}

/**
 * Converte tanto um JSON estruturado da IA quanto um laudo em Markdown/LaTeX legado
 * em um objeto StructuredDiscursiveReport pronto para renderização visual em cards.
 */
export function parseDiscursiveReport(
  rawInput: string,
  defaultMaxScore = 100,
  defaultLines = 29
): StructuredDiscursiveReport {
  const trimmed = (rawInput || '').trim();

  // 1. Tenta extrair JSON estruturado se a IA respondeu em JSON
  const jsonCandidate = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed && (parsed.finalNetScore !== undefined || parsed.criteria || parsed.lineErrors)) {
        const maxS = parsePtNumber(parsed.maxScore, defaultMaxScore);
        const nc = parsePtNumber(parsed.contentScore, 0);
        const tl = parsePtNumber(parsed.totalLines, defaultLines);
        const ne = parsePtNumber(parsed.grammarErrorsCount, (parsed.lineErrors || []).length);
        const ded = Math.abs(parsePtNumber(parsed.grammarDeduction, 0));
        const nf = parsePtNumber(parsed.finalNetScore, Math.max(0, nc - ded));

        return {
          contentScore: nc,
          maxScore: maxS,
          totalLines: tl,
          grammarErrorsCount: ne,
          grammarDeduction: ded,
          finalNetScore: nf,
          formulaSummary:
            parsed.formulaSummary ||
            `NF = ${nc.toFixed(2).replace('.', ',')} - ${ded.toFixed(2).replace('.', ',')} = ${nf.toFixed(2).replace('.', ',')}`,
          historicalComparison: parsed.historicalComparison
            ? {
                improvedPoints: Array.isArray(parsed.historicalComparison.improvedPoints)
                  ? parsed.historicalComparison.improvedPoints
                  : [],
                recurringAlerts: Array.isArray(parsed.historicalComparison.recurringAlerts)
                  ? parsed.historicalComparison.recurringAlerts
                  : [],
                summary: parsed.historicalComparison.summary || '',
              }
            : undefined,
          criteria: Array.isArray(parsed.criteria)
            ? parsed.criteria.map((c: any) => {
                const obt = parsePtNumber(c.obtained, 0);
                const mx = parsePtNumber(c.max, 25);
                return {
                  title: String(c.title || 'Quesito Avaliado'),
                  obtained: obt,
                  max: mx,
                  deduction: Math.max(0, Number((mx - obt).toFixed(2))),
                  feedback: String(c.feedback || ''),
                };
              })
            : [],
          lineErrors: Array.isArray(parsed.lineErrors)
            ? parsed.lineErrors.map((e: any) => ({
                line: String(e.line || '—'),
                category: String(e.category || categorizeErrorText(String(e.explanation || ''))),
                original: String(e.original || ''),
                correction: String(e.correction || ''),
                explanation: String(e.explanation || ''),
              }))
            : [],
          paragraphAnalysis: Array.isArray(parsed.paragraphAnalysis)
            ? parsed.paragraphAnalysis.map((p: any) => ({
                paragraph: String(p.paragraph || 'Parágrafo'),
                strengths: String(p.strengths || ''),
                improvements: String(p.improvements || ''),
              }))
            : [],
          actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan.map(String) : [],
          modelRewrite: String(parsed.modelRewrite || ''),
          rawText: trimmed,
        };
      }
    } catch {
      // Continua para o parser inteligente de Markdown/LaTeX abaixo
    }
  }

  // 2. Parser Inteligente para Laudos em Markdown / LaTeX (como o relatório Cebraspe PRF 2021)
  const cleanMd = trimmed
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\times/g, '×')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\approx/g, '≈');

  // Extrai NC, TL, NE, Desconto e NF
  const ncMatch =
    cleanMd.match(/Nota de Conte[úu]do\s*\(NC\)[^0-9]*(\d+[.,]?\d*)\s*\/\s*(\d+[.,]?\d*)/i) ||
    cleanMd.match(/NC\s*=\s*(\d+[.,]?\d*)/i);
  const contentScore = ncMatch ? parsePtNumber(ncMatch[1], 85) : 85;
  const maxScore = ncMatch && ncMatch[2] ? parsePtNumber(ncMatch[2], defaultMaxScore) : defaultMaxScore;

  const tlMatch = cleanMd.match(/\(TL\)[^0-9]*(\d+)/i) || cleanMd.match(/(\d+)\s*linhas efetivamente/i);
  const totalLines = tlMatch ? parsePtNumber(tlMatch[1], defaultLines) : defaultLines;

  const neMatch = cleanMd.match(/\(NE\)[^0-9]*(\d+)/i) || cleanMd.match(/(\d+)\s*erros/i);

  const nfMatch =
    cleanMd.match(/NOTA FINAL L[ÍI]QUIDA\s*\(NF\)[^0-9]*(\d+[.,]?\d*)/i) ||
    cleanMd.match(/NF\s*=\s*(\d+[.,]?\d*)\s*pontos/i);

  // Extrai Quesitos da tabela ou listas markdown
  const criteria: CriterionEvaluation[] = [];
  const tableLines = cleanMd.split('\n');
  for (const line of tableLines) {
    if (line.trim().startsWith('|') && !line.includes('---') && !/Quesito\s*\|\s*Valor/i.test(line)) {
      const cols = line
        .split('|')
        .map((c) => c.replace(/\*\*/g, '').trim())
        .filter(Boolean);
      if (cols.length >= 4 && !/NOTA DE CONTE[ÚU]DO/i.test(cols[0])) {
        const title = cols[0];
        const max = parsePtNumber(cols[1], 0);
        const obtained = parsePtNumber(cols[2], 0);
        const feedback = cols[4] || cols[3] || '';
        if (max > 0) {
          criteria.push({
            title,
            max,
            obtained,
            deduction: Math.max(0, Number((max - obtained).toFixed(2))),
            feedback,
          });
        }
      }
    }
  }

  // Extrai Erros Linha a Linha
  const lineErrors: LineErrorItem[] = [];
  const lineErrorRegex = /\*\*Linha\s*(\d+)\*\*\s*\|\s*`?([^`|]+)`?\s*(?:→|->)\s*\*\*`?([^`*|]+)`?\*\*\s*\|\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = lineErrorRegex.exec(cleanMd)) !== null) {
    const explanation = m[4].replace(/\*\*/g, '').trim();
    lineErrors.push({
      line: `Linha ${m[1].padStart(2, '0')}`,
      category: categorizeErrorText(explanation),
      original: m[2].trim(),
      correction: m[3].trim(),
      explanation,
    });
  }

  const grammarErrorsCount = neMatch ? parsePtNumber(neMatch[1], lineErrors.length) : lineErrors.length;
  const computedDeduction =
    totalLines > 0 ? Number(((2 * grammarErrorsCount) / totalLines).toFixed(2)) : 0;
  const finalNetScore = nfMatch
    ? parsePtNumber(nfMatch[1], Math.max(0, contentScore - computedDeduction))
    : Math.max(0, Number((contentScore - computedDeduction).toFixed(2)));

  // Extrai Análise por Parágrafo
  const paragraphAnalysis: ParagraphAnalysisItem[] = [];
  const paraBlocks = cleanMd.split(/###\s*\*\*(\d+º\s*Par[áa]grafo[^*]*)\*\*/i);
  if (paraBlocks.length > 1) {
    for (let i = 1; i < paraBlocks.length; i += 2) {
      const pTitle = paraBlocks[i].trim();
      const pBody = (paraBlocks[i + 1] || '').split(/---|\n##\s/)[0].trim();
      const bullets = pBody
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
        .filter(Boolean);
      paragraphAnalysis.push({
        paragraph: pTitle,
        strengths: bullets[0] || '',
        improvements: bullets.slice(1).join(' '),
      });
    }
  }

  // Extrai Reescrita Modelo
  let modelRewrite = '';
  const rewriteSplit = cleanMd.split(/VERS[ÃA]O NOTA M[ÁA]XIMA[^\n]*/i);
  if (rewriteSplit.length > 1) {
    modelRewrite = rewriteSplit[1]
      .replace(/^[\s*-]+/, '')
      .replace(/```/g, '')
      .replace(/\*\*/g, '')
      .trim();
  }

  return {
    contentScore,
    maxScore,
    totalLines,
    grammarErrorsCount,
    grammarDeduction: Number(Math.max(0, contentScore - finalNetScore).toFixed(2)) || computedDeduction,
    finalNetScore,
    formulaSummary: `NF = ${contentScore.toFixed(2).replace('.', ',')} - (2 × ${grammarErrorsCount} / ${totalLines}) = ${finalNetScore.toFixed(2).replace('.', ',')}`,
    criteria,
    lineErrors,
    paragraphAnalysis,
    actionPlan: [
      'Substituir termos coloquiais ou vagos por terminologia técnica e objetiva da disciplina.',
      'Conectar cada exemplo citado diretamente à causa ou consequência exigida pelo comando da questão.',
      'Revisar pontuação (especialmente vírgulas em adjuntos deslocados) e evitar repetição de palavras no mesmo parágrafo.',
    ],
    modelRewrite,
    rawText: cleanMd,
  };
}

/**
 * Analisa todo o histórico de redações do aluno para extrair:
 * - Evolução das notas ao longo do tempo
 * - Categorias de erros constantes / recorrentes
 * - Resumo compacto para alimentar o prompt da IA na próxima correção
 */
export function buildHistoricalIntelligence(
  historyList: Array<{
    id: string;
    date: string;
    themeTitle: string;
    banca: string;
    correctionReport: string;
  }>
) {
  if (!historyList || historyList.length === 0) {
    return {
      timeline: [],
      averageScore: 0,
      bestScore: 0,
      scoreDelta: 0,
      recurringCategories: [] as RecurringCategoryStat[],
      promptContextForAi: '',
    };
  }

  // Do mais antigo para o mais recente para o gráfico de evolução
  const chronological = [...historyList].reverse().map((item, idx) => {
    const parsed = parseDiscursiveReport(item.correctionReport);
    const pct = parsed.maxScore > 0 ? Math.round((parsed.finalNetScore / parsed.maxScore) * 100) : parsed.finalNetScore;
    return {
      index: idx + 1,
      id: item.id,
      date: item.date,
      themeTitle: item.themeTitle,
      banca: item.banca,
      finalNetScore: parsed.finalNetScore,
      maxScore: parsed.maxScore,
      normalizedPct: pct,
      errorsCount: parsed.grammarErrorsCount,
      parsed,
    };
  });

  const scores = chronological.map((c) => c.finalNetScore);
  const averageScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
  const bestScore = Number(Math.max(...scores).toFixed(2));
  const scoreDelta =
    scores.length >= 2 ? Number((scores[scores.length - 1] - scores[0]).toFixed(2)) : 0;

  // Contabiliza frequência de categorias de erro em todas as redações
  const catCounter: Record<string, number> = {};
  let totalCategorizedErrors = 0;

  for (const item of chronological) {
    for (const err of item.parsed.lineErrors) {
      const cat = err.category || categorizeErrorText(err.explanation);
      catCounter[cat] = (catCounter[cat] || 0) + 1;
      totalCategorizedErrors++;
    }
    // Verifica também quedas nos quesitos de conteúdo
    for (const crit of item.parsed.criteria) {
      if (crit.deduction > 0) {
        const lower = (crit.title + ' ' + crit.feedback).toLowerCase();
        if (lower.includes('exemplo') || lower.includes('aprofund') || lower.includes('superficial') || lower.includes('nexo')) {
          catCounter['Repertório / Nexo Argumentativo'] = (catCounter['Repertório / Nexo Argumentativo'] || 0) + 1;
          totalCategorizedErrors++;
        }
      }
    }
  }

  const ADVICE_MAP: Record<string, string> = {
    'Propriedade Vocabular':
      'Evite expressões coloquiais ou hiperbólicas ("de suma importância", " patamar astronômico"). Prefira verbos e substantivos técnicos diretos.',
    'Pontuação / Vírgula':
      'Atenção redobrada às vírgulas obrigatórias após locuções adverbiais deslocadas e antes de orações coordenadas adversativas.',
    'Regência & Crase':
      'Revise a regência de verbos/nomes jurídicos (ex: "visar a", "impacto em/sobre", "obediência a") e o uso de crase em locuções paralelas.',
    'Coesão & Repetição':
      'Use pronomes demonstrativos, sinônimos técnicos ou hiperônimos para não repetir o mesmo radical em linhas próximas.',
    'Morfossintaxe & Nexo':
      'Prefira períodos mais curtos na ordem direta (Sujeito + Verbo + Complemento) para evitar truncamentos e falsos paralelismos.',
    'Repertório / Nexo Argumentativo':
      'Não apenas cite exemplos ou leis soltas: explique em 1 período como esse exemplo comprova a causa ou consequência pedida no quesito.',
    'Ortografia & Acentuação':
      'Faça uma leitura final exclusiva para caçar escorregões de acentuação gráfica, hífen e grafia.',
    'Concordância':
      'Confira sempre o núcleo do sujeito quando houver termos preposicionados longos entre o sujeito e o verbo.',
  };

  const recurringCategories: RecurringCategoryStat[] = Object.entries(catCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalCategorizedErrors > 0 ? Math.round((count / totalCategorizedErrors) * 100) : 0,
      advice:
        ADVICE_MAP[category] ||
        'Revise este aspecto na leitura final antes de passar o rascunho a limpo.',
    }));

  // Gera o resumo para injetar no prompt da próxima correção
  const recentSlice = chronological.slice(-4);
  const recentScoresSummary = recentSlice
    .map(
      (r) =>
        `- [${r.date}] Tema "${r.themeTitle.slice(0, 45)}": Nota Final = ${r.finalNetScore}/${r.maxScore} (${r.errorsCount} desvios gramaticais)`
    )
    .join('\n');

  const topRecurringSummary = recurringCategories
    .slice(0, 3)
    .map((c) => `${c.category} (${c.count} ocorrências)`)
    .join(', ');

  const promptContextForAi = `HISTÓRICO ANTERIOR DESTE ALUNO (${historyList.length} redações salvas):
Notas recentes:
${recentScoresSummary}
Erros mais recorrentes do aluno em redações passadas: ${topRecurringSummary || 'Ainda em mapeamento'}.
IMPORTANTE: Compare o texto atual com esse histórico! No campo "historicalComparison" do JSON, aponte especificamente o que o aluno EVOLUIU/SUPEROU em relação aos erros passados e alerte se ele REINCIDIU em algum vício recorrente.`;

  return {
    timeline: chronological,
    averageScore,
    bestScore,
    scoreDelta,
    recurringCategories,
    promptContextForAi,
  };
}
