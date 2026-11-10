/**
 * Motor Matemático de Score e Revisões Inteligentes — Ouroboros 2.0
 *
 * Implementa o algoritmo de domínio bayesiano, penalização por esquecimento (decaimento lambda)
 * e o agendador adaptativo de revisões espaçadas.
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
  level: 'high' | 'medium' | 'low' | 'unstudied';
  nextReviewDate: string;   // Data sugerida para revisão (YYYY-MM-DD)
  reviewIntervalDays: number;
  isDueForReview: boolean;
  daysUntilReview: number;
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

  const smoothedAccuracy = ((qCorrect + 5) / (qTotal + 10)) * 100;

  let perceptionWeight = 0.5;
  let practicalWeight = 0.5;

  if (qTotal >= 20) {
    perceptionWeight = 0.2;
    practicalWeight = 0.8;
  } else if (qTotal >= 10) {
    perceptionWeight = 0.35;
    practicalWeight = 0.65;
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
  const baseLambda = 0.035;
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
    const lastDate = new Date(dateStr);
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
      const t =
        r?.questions?.total ??
        c + (r?.incorrectQuestions ?? 0);
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
  let level: 'high' | 'medium' | 'low' | 'unstudied' = 'high';

  if (!hasStudyHistory && normalizedInput.questionsTotal === 0 && !normalizedInput.lastStudiedDate) {
    level = 'unstudied';
  } else if (currentScore < 50) {
    statusColor = 'red';
    level = 'low';
  } else if (currentScore < 75) {
    statusColor = 'yellow';
    level = 'medium';
  } else {
    statusColor = 'green';
    level = 'high';
  }

  let reviewIntervalDays = 18;
  if (currentScore < 40) {
    reviewIntervalDays = 4;
  } else if (currentScore < 70) {
    reviewIntervalDays = 18;
  } else if (currentScore < 85) {
    reviewIntervalDays = 45;
  } else {
    reviewIntervalDays = 75;
  }

  const baseReviewDate = normalizedInput.lastStudiedDate
    ? new Date(normalizedInput.lastStudiedDate)
    : new Date();
  if (isNaN(baseReviewDate.getTime())) {
    baseReviewDate.setTime(Date.now());
  }
  baseReviewDate.setDate(baseReviewDate.getDate() + reviewIntervalDays);
  const nextReviewDate = baseReviewDate.toISOString().split('T')[0];

  const daysUntilReview = reviewIntervalDays - daysSince;
  const isDueForReview = hasStudyHistory && (daysUntilReview <= 0 || currentScore < 55);

  return {
    score: currentScore,
    currentScore,
    baseScore,
    forgettingPenalty,
    lambda,
    daysSinceLastStudy: daysSince,
    statusColor,
    level,
    nextReviewDate,
    reviewIntervalDays,
    isDueForReview,
    daysUntilReview,
  };
}
