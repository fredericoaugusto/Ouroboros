/**
 * Motor Matemático de Score e Revisões Inteligentes — Alexandria (Estudos 2.0)
 *
 * Implementa o algoritmo de domínio bayesiano, penalização por esquecimento (decaimento lambda)
 * e o agendador adaptativo de revisões espaçadas com explicação didática em tempo real.
 */

export interface TopicScoreInput {
  perceivedMastery: number; // 0 a 5 (autodeclarado)
  relevance: number;        // 0 a 5 (peso no edital)
  difficulty: number;       // 0 a 5 (dificuldade pessoal)
  questionsTotal: number;   // Total de questões acumuladas
  questionsCorrect: number; // Total de acertos acumulados
  lastStudiedDate?: string; // Data ISO ou YYYY-MM-DD
  daysWithStudy: number;    // Quantidade de dias distintos com estudo registrado
}

export interface TopicScoreResult {
  score: number;            // 0 a 100
  currentScore: number;     // alias para score (0 a 100)
  baseScore: number;        // 0 a 100 (antes do esquecimento)
  forgettingPenalty: number;// Pontos perdidos pelo tempo
  lambda: number;           // Taxa de decaimento
  daysSinceLastStudy: number;
  statusColor: 'green' | 'yellow' | 'red';
  color: 'emerald' | 'amber' | 'rose';
  level: 'high' | 'medium' | 'low' | 'unstudied';
  nextReviewDate: string;   // Data sugerida para revisão (YYYY-MM-DD)
  reviewIntervalDays: number;
  isDueForReview: boolean;
  daysUntilReview: number;
  correctQuestions: number;
  totalQuestions: number;
  rawAccuracy: number;      // 0 a 1
  lastStudyDate: string | null;
}

export interface SmartSessionReviewEstimate {
  days: number;
  tierLabel: string;
  tierColor: 'rose' | 'amber' | 'emerald' | 'indigo';
  reason: string;
  sessionAccuracyPct: number | null;
}

/**
 * Calcula o intervalo inteligente de revisão (em dias) para uma sessão de estudo
 * levando em conta acertos/erros da sessão, amostragem de questões, histórico no tópico
 * e pesos de Relevância (R) e Dificuldade (D).
 */
export function calculateSmartSessionReview(params: {
  sessionCorrect: number;
  sessionIncorrect: number;
  previousSessionsCount?: number;
  relevance?: number;
  difficulty?: number;
}): SmartSessionReviewEstimate {
  const corr = Math.max(0, params.sessionCorrect || 0);
  const inc = Math.max(0, params.sessionIncorrect || 0);
  const total = corr + inc;
  const prevCount = Math.max(0, params.previousSessionsCount || 0);
  const rel = params.relevance ?? 3;
  const diff = params.difficulty ?? 3;

  // Fator de ajuste por Relevância na prova e Dificuldade pessoal (entre 0.80 e 1.20)
  // Tópicos mais difíceis/importantes encurtam o prazo para revisar mais cedo
  const weightModifier = 1 - (rel - 3) * 0.05 - (diff - 3) * 0.05;

  if (total === 0) {
    if (prevCount === 0) {
      const days = Math.max(3, Math.round(7 * weightModifier));
      return {
        days,
        tierLabel: 'Fixação Inicial',
        tierColor: 'indigo',
        reason: `Sessão teórica sem questões (1º contato com o tópico). O algoritmo agenda a primeira revisão de fixação em ${days} dias para evitar a queda brusca inicial da curva de Ebbinghaus.`,
        sessionAccuracyPct: null,
      };
    } else {
      const baseDays = Math.min(25, 12 + prevCount * 3);
      const days = Math.max(5, Math.round(baseDays * weightModifier));
      return {
        days,
        tierLabel: 'Manutenção Teórica',
        tierColor: 'emerald',
        reason: `Sessão sem questões em tópico já estudado (${prevCount}x antes). O intervalo expande para ${days} dias pelo efeito de espaçamento acumulado.`,
        sessionAccuracyPct: null,
      };
    }
  }

  const accPct = Math.round((corr / total) * 100);
  // Bônus leve de espaçamento se já estudou o tópico várias vezes e manteve bom acerto
  const spacingBonus = accPct >= 70 ? Math.min(8, prevCount * 2) : 0;

  if (accPct < 40) {
    const days = Math.max(2, Math.round(3 * weightModifier));
    return {
      days,
      tierLabel: 'Crítico • Urgente',
      tierColor: 'rose',
      reason: `Taxa de acerto de ${accPct}% (${corr}/${total} questões). Abaixo de 40% indica lacuna na base: revisão curta de emergência em ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  if (accPct <= 55) {
    const days = Math.max(4, Math.round(6 * weightModifier));
    return {
      days,
      tierLabel: 'Alerta • Reforço',
      tierColor: 'amber',
      reason: `Taxa de acerto de ${accPct}% (${corr}/${total} questões). Na faixa de 40%–55%, o tópico exige revisão de reforço na próxima semana (${days} dias).`,
      sessionAccuracyPct: accPct,
    };
  }

  if (accPct < 70) {
    const days = Math.max(7, Math.round((11 + spacingBonus * 0.5) * weightModifier));
    return {
      days,
      tierLabel: 'Em Construção',
      tierColor: 'amber',
      reason: `Taxa de acerto de ${accPct}% (${corr}/${total} questões). Desempenho intermediário (56%–69%): revisão programada para ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  if (accPct < 80) {
    const days = Math.max(10, Math.round((16 + spacingBonus) * weightModifier));
    return {
      days,
      tierLabel: 'Bom Domínio',
      tierColor: 'emerald',
      reason: `Taxa de acerto de ${accPct}% (${corr}/${total} questões). Bom aproveitamento (70%–79%): revisão espaçada em ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  if (accPct < 89) {
    // Ex: 5 acertos e 1 erro = 83%
    const sampleFactor = total < 4 ? 0.85 : 1.0;
    const days = Math.max(14, Math.round((22 + spacingBonus) * sampleFactor * weightModifier));
    return {
      days,
      tierLabel: 'Domínio Forte',
      tierColor: 'emerald',
      reason: `Taxa de acerto de ${accPct}% (${corr}/${total} questões). Desempenho forte (80%–88%): o algoritmo amplia a janela para ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  // Acerto >= 89% (ex: 9/10 ou 100%)
  if (total <= 4) {
    const days = Math.max(14, Math.round((19 + spacingBonus) * weightModifier));
    return {
      days,
      tierLabel: 'Alto Acerto (Amostra Curta)',
      tierColor: 'emerald',
      reason: `Taxa de ${accPct}% (${corr}/${total}), mas com poucas questões resolvidas (${total}q). Por segurança estatística (suavização de Laplace), a revisão ocorre em ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  if (total < 15) {
    const days = Math.max(20, Math.round((30 + spacingBonus) * weightModifier));
    return {
      days,
      tierLabel: 'Consolidado',
      tierColor: 'emerald',
      reason: `Excelente taxa de ${accPct}% (${corr}/${total} questões). Assunto consolidado na memória: revisão de manutenção em ${days} dias.`,
      sessionAccuracyPct: accPct,
    };
  }

  const days = Math.max(28, Math.round((42 + spacingBonus) * weightModifier));
  return {
    days,
    tierLabel: 'Domínio Avançado',
    tierColor: 'emerald',
    reason: `Altíssima precisão de ${accPct}% em bateria longa (${corr}/${total} questões). Tópico dominado: revisão de longo prazo em ${days} dias.`,
    sessionAccuracyPct: accPct,
  };
}

export function calculateBaseScore(
  perceivedMastery: number,
  questionsTotal: number,
  questionsCorrect: number
): { baseScore: number; perceptionWeight: number; practicalWeight: number } {
  const safeMastery = Number.isFinite(perceivedMastery) ? perceivedMastery : 3;
  const qTotal = Number.isFinite(questionsTotal) ? questionsTotal : 0;
  const qCorrect = Number.isFinite(questionsCorrect) ? questionsCorrect : 0;

  const perceptionScore = Math.max(0, Math.min(5, safeMastery)) * 20;

  if (qTotal <= 0) {
    return {
      baseScore: perceptionScore,
      perceptionWeight: 1.0,
      practicalWeight: 0.0,
    };
  }

  // Suavização Bayesiana leve (+2/+4) para refletir com fidelidade mesmo baterias de 2 a 10 questões
  const smoothedAccuracy = ((qCorrect + 2) / (qTotal + 4)) * 100;

  let perceptionWeight = 0.35;
  let practicalWeight = 0.65;

  if (qTotal >= 15) {
    perceptionWeight = 0.15;
    practicalWeight = 0.85;
  } else if (qTotal >= 6) {
    perceptionWeight = 0.25;
    practicalWeight = 0.75;
  }

  const baseScore = Math.round(
    perceptionWeight * perceptionScore + practicalWeight * smoothedAccuracy
  );

  return {
    baseScore: Math.max(0, Math.min(100, baseScore)),
    perceptionWeight,
    practicalWeight,
  };
}

export function calculateLambda(
  relevance: number,
  difficulty: number,
  daysWithStudy: number
): number {
  const baseLambda = 0.032;
  const rel = Math.max(0, Math.min(5, Number.isFinite(relevance) ? relevance : 3));
  const diff = Math.max(0, Math.min(5, Number.isFinite(difficulty) ? difficulty : 3));
  const days = Math.max(1, Number.isFinite(daysWithStudy) ? daysWithStudy : 1);

  const urgencyFactor = 1.0 + rel * 0.08 + diff * 0.08;
  const memoryFactor = 1.0 / Math.sqrt(days);

  return Number((baseLambda * urgencyFactor * memoryFactor).toFixed(4));
}

export function getDaysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  try {
    const parts = String(dateStr).split('T')[0].split('-').map(Number);
    const lastDate =
      parts.length === 3
        ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
        : new Date(dateStr);
    if (isNaN(lastDate.getTime())) return 0;
    const today = new Date();
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Aceita tanto um objeto `TopicScoreInput` quanto `(recordsArray, relevance, difficulty, mastery)`.
 */
export function computeTopicScore(
  inputOrRecords: TopicScoreInput | any[],
  relevanceArg = 3,
  difficultyArg = 3,
  masteryArg = 3
): TopicScoreResult {
  let normalizedInput: TopicScoreInput;
  let hasStudyHistory = true;

  if (Array.isArray(inputOrRecords)) {
    const records = inputOrRecords;
    hasStudyHistory = records.length > 0;
    let qTotal = 0;
    let qCorrect = 0;
    const uniqueDates = new Set<string>();
    let latestDate: string | undefined = undefined;

    for (const r of records) {
      const c = r?.questions?.correct ?? r?.correctQuestions ?? 0;
      const t = r?.questions?.total ?? c + (r?.incorrectQuestions ?? 0);
      qTotal += t;
      qCorrect += c;
      if (r?.date) {
        const dStr = String(r.date).split('T')[0];
        uniqueDates.add(dStr);
        if (!latestDate || dStr > latestDate) {
          latestDate = dStr;
        }
      }
    }

    normalizedInput = {
      perceivedMastery: masteryArg ?? 3,
      relevance: relevanceArg ?? 3,
      difficulty: difficultyArg ?? 3,
      questionsTotal: qTotal,
      questionsCorrect: qCorrect,
      lastStudiedDate: latestDate,
      daysWithStudy: Math.max(1, uniqueDates.size),
    };
  } else {
    normalizedInput = {
      perceivedMastery: inputOrRecords?.perceivedMastery ?? 3,
      relevance: inputOrRecords?.relevance ?? 3,
      difficulty: inputOrRecords?.difficulty ?? 3,
      questionsTotal: inputOrRecords?.questionsTotal ?? 0,
      questionsCorrect: inputOrRecords?.questionsCorrect ?? 0,
      lastStudiedDate: inputOrRecords?.lastStudiedDate,
      daysWithStudy: inputOrRecords?.daysWithStudy ?? 1,
    };
  }

  const { baseScore } = calculateBaseScore(
    normalizedInput.perceivedMastery,
    normalizedInput.questionsTotal,
    normalizedInput.questionsCorrect
  );

  const lambda = calculateLambda(
    normalizedInput.relevance,
    normalizedInput.difficulty,
    normalizedInput.daysWithStudy
  );

  const daysSince = getDaysSince(normalizedInput.lastStudiedDate);
  const retentionFactor = Math.exp(-lambda * daysSince);
  const currentScore = Math.max(
    0,
    Math.min(100, Math.round(baseScore * retentionFactor))
  );
  const forgettingPenalty = baseScore - currentScore;

  let statusColor: 'green' | 'yellow' | 'red' = 'green';
  let color: 'emerald' | 'amber' | 'rose' = 'emerald';
  let level: 'high' | 'medium' | 'low' | 'unstudied' = 'high';

  if (
    !hasStudyHistory &&
    normalizedInput.questionsTotal === 0 &&
    !normalizedInput.lastStudiedDate
  ) {
    level = 'unstudied';
  } else if (currentScore < 55) {
    statusColor = 'red';
    color = 'rose';
    level = 'low';
  } else if (currentScore < 75) {
    statusColor = 'yellow';
    color = 'amber';
    level = 'medium';
  } else {
    statusColor = 'green';
    color = 'emerald';
    level = 'high';
  }

  // Usa o mesmo motor adaptativo para estimar o intervalo ideal de revisão do tópico
  const smartEstimate = calculateSmartSessionReview({
    sessionCorrect: normalizedInput.questionsCorrect,
    sessionIncorrect: Math.max(
      0,
      normalizedInput.questionsTotal - normalizedInput.questionsCorrect
    ),
    previousSessionsCount: Math.max(0, normalizedInput.daysWithStudy - 1),
    relevance: normalizedInput.relevance,
    difficulty: normalizedInput.difficulty,
  });

  const reviewIntervalDays = smartEstimate.days;

  const parts = normalizedInput.lastStudiedDate
    ? String(normalizedInput.lastStudiedDate).split('T')[0].split('-').map(Number)
    : [];
  const baseReviewDate =
    parts.length === 3
      ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
      : new Date();
  if (isNaN(baseReviewDate.getTime())) {
    baseReviewDate.setTime(Date.now());
  }
  baseReviewDate.setDate(baseReviewDate.getDate() + reviewIntervalDays);
  const ry = baseReviewDate.getFullYear();
  const rm = String(baseReviewDate.getMonth() + 1).padStart(2, '0');
  const rd = String(baseReviewDate.getDate()).padStart(2, '0');
  const nextReviewDate = `${ry}-${rm}-${rd}`;

  const daysUntilReview = reviewIntervalDays - daysSince;
  const isDueForReview = hasStudyHistory && (daysUntilReview <= 0 || currentScore < 55);
  const rawAccuracy =
    normalizedInput.questionsTotal > 0
      ? normalizedInput.questionsCorrect / normalizedInput.questionsTotal
      : 0;

  return {
    score: currentScore,
    currentScore,
    baseScore,
    forgettingPenalty,
    lambda,
    daysSinceLastStudy: daysSince,
    statusColor,
    color,
    level,
    nextReviewDate,
    reviewIntervalDays,
    isDueForReview,
    daysUntilReview,
    correctQuestions: normalizedInput.questionsCorrect,
    totalQuestions: normalizedInput.questionsTotal,
    rawAccuracy,
    lastStudyDate: normalizedInput.lastStudiedDate || null,
  };
}
