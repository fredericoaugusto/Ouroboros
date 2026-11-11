import { StudyRecord, EditalTopic, EditalSubject } from '../context/DataContext';
import { SimuladoRecord } from '../app/actions';

export interface ScoreImpactFactor {
  type: 'positive' | 'negative' | 'neutral';
  label: string;
  detail: string;
}

export interface ScientificReviewTip {
  badge: string;
  title: string;
  description: string;
  actionType: 'theory_questions' | 'active_recall_questions' | 'notes_scan_questions' | 'fast_maintenance';
}

export interface TopicScoreResult {
  score: number; // 0 - 100 (Score Atual combinando Base + Retenção)
  baseScore: number; // 0 - 100 (Força de Armazenamento / Qualidade de Aprendizagem antes do decaimento)
  retention: number; // 0 - 100 (%) - Probabilidade estimada de recordação hoje (FSRS-4.5)
  priorityROI: number; // 0 - 100 - Krono Priority Engine: Retorno sobre Investimento de estudar este tópico agora
  level: 'strong' | 'medium' | 'weak' | 'unstarted';
  nextReviewDays: number; // Dias recomendados a partir do último estudo (inversão analítica exata FSRS-4.5)
  nextReviewDate: string | null; // YYYY-MM-DD
  daysSinceLastStudy: number;
  distinctStudyDays: number;
  totalQuestions: number;
  correctQuestions: number;
  rawAccuracy: number | null;
  smoothedAccuracy: number;
  lastSessionAccuracy: number | null;
  totalHours: number;
  importance: number; // 0 - 5
  difficulty: number; // 0 - 5
  mastery: number; // 0 - 5
  lambda: number; // Taxa equivalente de decaimento inicial (/dia)
  memoryStabilityDays: number; // Estabilidade S (dias para a retenção cair de 100% para 90% no FSRS-4.5)
  dailyDecayPercent: number; // Perda percentual diária média inicial (%/dia)
  calibrationBias: number | null; // Erro médio (Retenção Prevista vs Observada) nas revisões do tópico
  explanation: string; // Explicação curta para tooltips
  detailedFormulaSteps: string[]; // Passo a passo matemático para transparência
  impactFactors: ScoreImpactFactor[]; // Diagnóstico claro do que está subindo ou descendo o Score
  scientificReviewTip: ScientificReviewTip; // Recomendação baseada em ciência cognitiva de como revisar
}

export interface SubjectScoreResult {
  subjectScore: number;
  subjectRetention: number;
  topicsEvaluated: number;
  totalTopics: number;
  studyQuestionsTotal: number;
  studyQuestionsCorrect: number;
  simuladoQuestionsTotal: number;
  simuladoQuestionsCorrect: number;
  combinedAccuracy: number | null;
  daysSinceLastStudy: number;
  explanation: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function parseLocalDate(dateStr: string): Date {
  const clean = (dateStr || '').split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }
  return new Date(dateStr);
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula o Fator de Calibração Pessoal do Usuário (alpha_user in [0.70, 1.35])
 * e o Erro Médio de Calibração comparando a retenção prevista antes de cada revisão
 * com a acurácia real observada na sessão de revisão.
 */
export function computeUserRetentionMultiplier(allStudyRecords: StudyRecord[]): number {
  if (!allStudyRecords || allStudyRecords.length < 4) return 1.0;

  const byTopic = new Map<string, StudyRecord[]>();
  for (const r of allStudyRecords) {
    if (!r.subject || !r.topic) continue;
    const key = `${r.subject}::${r.topic}`;
    const list = byTopic.get(key) || [];
    list.push(r);
    byTopic.set(key, list);
  }

  let weightedRetentionSum = 0;
  let weightTotal = 0;

  byTopic.forEach((records) => {
    if (records.length < 2) return;
    const sorted = [...records].sort(
      (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gapDays = Math.max(
        1,
        Math.round(
          (parseLocalDate(curr.date).getTime() - parseLocalDate(prev.date).getTime()) / MS_PER_DAY
        )
      );
      const qTotal = curr.questions?.total || 0;
      const qCorrect = curr.questions?.correct || 0;
      if (gapDays >= 2 && qTotal >= 3) {
        const acc = qCorrect / qTotal;
        // Retenção esperada padrão FSRS em S=14 dias
        const expectedR = Math.pow(1 + (19 / 81) * (gapDays / 14), -0.5);
        const ratio = clamp(acc / Math.max(0.25, expectedR), 0.65, 1.45);
        weightedRetentionSum += ratio * Math.min(15, qTotal);
        weightTotal += Math.min(15, qTotal);
      }
    }
  });

  if (weightTotal < 10) return 1.0;
  return clamp(weightedRetentionSum / weightTotal, 0.75, 1.35);
}

/**
 * Calcula o ritmo médio de resolução de questões do aluno (em minutos por questão)
 * para uma disciplina específica, usando suavização Bayesiana com o ritmo global do aluno.
 */
export function computeSubjectQuestionPace(
  subjectName: string,
  allStudyRecords: StudyRecord[]
): { minutesPerQuestion: number; sampleQuestions: number; isEstimatedFromGlobal: boolean } {
  const isExactOrCalc = /racioc[ií]nio|matem[aá]tica|estat[ií]stica|contabilidade|f[ií]sica|economia|ti\b|inform[aá]tica/i.test(
    subjectName || ''
  );
  const priorPace = isExactOrCalc ? 3.0 : 1.9; // min/questão padrão inicial

  if (!allStudyRecords || allStudyRecords.length === 0) {
    return { minutesPerQuestion: priorPace, sampleQuestions: 0, isEstimatedFromGlobal: true };
  }

  let globalQ = 0;
  let globalMin = 0;
  let subjQ = 0;
  let subjMin = 0;

  for (const r of allStudyRecords) {
    const qTotal = r.questions?.total || 0;
    const mins = (r.studyTime || 0) / 60000;
    if (qTotal <= 0 || mins <= 0) continue;

    const pace = mins / qTotal;
    // Filtra sessões de prática/revisão ou sessões onde o ritmo por questão está numa faixa realista (0.4 a 8 min/questão)
    const isPracticeSession =
      r.category === 'questoes' ||
      r.category === 'revisao' ||
      (pace >= 0.4 && pace <= 6.5);

    if (!isPracticeSession) continue;

    globalQ += qTotal;
    globalMin += mins;

    if (r.subject?.toLowerCase() === subjectName?.toLowerCase()) {
      subjQ += qTotal;
      subjMin += mins;
    }
  }

  const globalPace =
    globalQ >= 10 ? clamp(globalMin / globalQ, 0.7, 5.5) : priorPace;

  // Suavização Bayesiana com peso de prior = 15 questões na matéria
  const priorWeight = 15;
  const blendedPace =
    (subjMin + priorWeight * globalPace) / (subjQ + priorWeight);

  return {
    minutesPerQuestion: Number(clamp(blendedPace, 0.7, 5.5).toFixed(1)),
    sampleQuestions: subjQ,
    isEstimatedFromGlobal: subjQ < 10,
  };
}

/**
 * KRONO SCORE ENGINE v3
 * - Etapa 1: Desempenho Bayesiano Consistente (prior p0 = 0.60, credibilidade contínua N/(N+10), EWMA temporal)
 * - Etapa 2: Score Base de Qualidade de Armazenamento (Retornos decrescentes não-lineares + Peso por Estudo Ativo)
 * - Etapa 3: Modelo de Memória FSRS-4.5 Puro e Consistente (Dificuldade D, Domínio S_base, Repetições K, Lapso e Calibração Pessoal)
 * - Etapa 4: Agendamento Analítico FSRS-4.5 + Censura por Data da Prova
 * - Etapa 5: Krono Priority Engine (ROI de Pontos na Prova) + Árvore de Decisão Completa
 */
export function computeTopicScore(params: {
  topic: EditalTopic | any;
  subjectName: string;
  studyRecords: StudyRecord[];
  simuladoRecords?: SimuladoRecord[];
  subjectTopicsCount?: number;
  userRetentionMultiplier?: number;
  examDate?: string | null;
}): TopicScoreResult {
  const {
    topic,
    subjectName,
    studyRecords,
    simuladoRecords = [],
    subjectTopicsCount = 10,
    userRetentionMultiplier = 1.0,
    examDate = null,
  } = params;

  const topicText = topic?.topic_text || '';
  const importance = clamp(Number(topic?.importance ?? topic?.userWeight ?? 3), 0, 5);
  const difficulty = clamp(Number(topic?.difficulty ?? 3), 0, 5);
  const mastery = clamp(Number(topic?.mastery ?? 3), 0, 5);
  const hasSavedNotes = Boolean(
    topic?.notes && String(topic.notes).replace(/<[^>]*>/g, '').trim().length > 15
  );

  const topicRecords = (studyRecords || []).filter(
    (r) => r.subject === subjectName && r.topic === topicText
  );

  // Questões de simulados da disciplina (ponderadas proporcionalmente por tópico)
  let simQuestionsForTopic = 0;
  let simCorrectForTopic = 0;
  if (simuladoRecords && simuladoRecords.length > 0 && subjectTopicsCount > 0) {
    for (const sim of simuladoRecords) {
      for (const sSub of sim.subjects || []) {
        if (sSub.subjectName?.toLowerCase() === subjectName?.toLowerCase()) {
          simQuestionsForTopic += (sSub.totalQuestions || 0) / subjectTopicsCount;
          simCorrectForTopic += (sSub.correct || 0) / subjectTopicsCount;
        }
      }
    }
  }

  const isCompletedFlag = Boolean(
    topic?.is_completed || topic?.status === 'completed' || topic?.status === 'studied'
  );

  // Caso Tópico Não Iniciado
  if (topicRecords.length === 0 && !isCompletedFlag) {
    const subjPrior = clamp(
      Math.round((mastery / 5) * 65 + (5 - difficulty) * 4),
      15,
      65
    );
    // Tópico não iniciado com alta importância na prova tem altíssimo ROI de estudo inicial
    const unstartedROI = clamp(
      Math.round(importance * 14 + (100 - subjPrior) * 0.35),
      20,
      98
    );

    return {
      score: 0,
      baseScore: subjPrior,
      retention: 0,
      priorityROI: unstartedROI,
      level: 'unstarted',
      nextReviewDays: 0,
      nextReviewDate: null,
      daysSinceLastStudy: 0,
      distinctStudyDays: 0,
      totalQuestions: 0,
      correctQuestions: 0,
      rawAccuracy: null,
      smoothedAccuracy: 60,
      lastSessionAccuracy: null,
      totalHours: 0,
      importance,
      difficulty,
      mastery,
      lambda: 0.024,
      memoryStabilityDays: 4.5,
      dailyDecayPercent: 2.4,
      calibrationBias: null,
      explanation: 'Tópico ainda não estudado. Registre uma sessão de estudo para ativar o Score e o FSRS.',
      detailedFormulaSteps: ['Tópico sem registros de estudo contabilizados.'],
      impactFactors: [
        {
          type: 'neutral',
          label: 'Tópico ainda não iniciado',
          detail: 'Faça o 1º registro de estudo neste tópico para calibrar seu Score, Retenção e Revisões.',
        },
      ],
      scientificReviewTip: {
        badge: '1º Contato • Base Conceitual + Teste',
        title: 'Estudo Inicial + Bateria Diagnóstica (10 a 15 Questões)',
        description:
          'Como você ainda não iniciou este tópico, construa a base teórica/lei seca e finalize a sessão resolvendo 10 a 15 questões para ancorar a retenção inicial.',
        actionType: 'theory_questions',
      },
    };
  }

  // Ordenar registros cronologicamente
  const sortedRecords = [...topicRecords].sort(
    (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  let studyQTotal = 0;
  let studyQCorrect = 0;
  let totalMs = 0;
  let activeWeightedHours = 0;
  const uniqueDates = new Set<string>();

  for (const r of sortedRecords) {
    studyQTotal += r.questions?.total || 0;
    studyQCorrect += r.questions?.correct || 0;
    const ms = r.studyTime || 0;
    totalMs += ms;
    const hrs = ms / (1000 * 60 * 60);
    // Ponderação por Estudo Ativo (Testing Effect - Dunlosky 2013):
    // Questões e Revisão valem 1.25x em esforço de consolidação; Lei Seca 1.05x; Teoria passiva 0.85x
    const catMultiplier =
      r.category === 'questoes' || r.category === 'revisao'
        ? 1.25
        : r.category === 'leitura_lei' || r.category === 'jurisprudencia'
        ? 1.05
        : 0.85;
    activeWeightedHours += hrs * catMultiplier;
    if (r.date) uniqueDates.add(r.date.split('T')[0]);
  }

  const totalHours = totalMs / (1000 * 60 * 60);
  const distinctStudyDays = Math.max(1, uniqueDates.size);

  // Acertos da última sessão com questões + Média Móvel Exponencial (EWMA) das sessões
  const recordsWithQuestions = sortedRecords.filter((r) => (r.questions?.total || 0) > 0);
  let ewmaAccuracy: number | null = null;
  let lastSessionAccuracy: number | null = null;
  let calibrationErrors: number[] = [];

  if (recordsWithQuestions.length > 0) {
    const lastQRec = recordsWithQuestions[recordsWithQuestions.length - 1];
    lastSessionAccuracy =
      ((lastQRec.questions?.correct || 0) / (lastQRec.questions?.total || 1)) * 100;

    // EWMA com alpha = 0.45 (suaviza ruído de sessão única mantendo sensibilidade à evolução recente)
    const alpha = 0.45;
    for (let i = 0; i < recordsWithQuestions.length; i++) {
      const rec = recordsWithQuestions[i];
      const sessAcc = ((rec.questions?.correct || 0) / (rec.questions?.total || 1)) * 100;
      ewmaAccuracy = ewmaAccuracy === null ? sessAcc : alpha * sessAcc + (1 - alpha) * ewmaAccuracy;

      if (i > 0) {
        const prevRec = recordsWithQuestions[i - 1];
        const gap = Math.max(
          1,
          Math.round(
            (parseLocalDate(rec.date).getTime() - parseLocalDate(prevRec.date).getTime()) /
              MS_PER_DAY
          )
        );
        if (gap >= 2 && (rec.questions?.total || 0) >= 3) {
          const predR = Math.pow(1 + (19 / 81) * (gap / 12), -0.5) * 100;
          calibrationErrors.push(sessAcc - predR);
        }
      }
    }
  }

  const calibrationBias =
    calibrationErrors.length > 0
      ? Math.round(
          calibrationErrors.reduce((a, b) => a + b, 0) / calibrationErrors.length
        )
      : null;

  // 1. DESEMPENHO BAYESIANO CONSISTENTE (Prior Beta p0 = 0.60, W0 = 6, Credibilidade Contínua N/(N+10))
  const effectiveQTotal = studyQTotal + simQuestionsForTopic * 1.5;
  const effectiveQCorrect = studyQCorrect + simCorrectForTopic * 1.5;
  const rawAccuracy = studyQTotal > 0 ? (studyQCorrect / studyQTotal) * 100 : null;

  const priorWeight = 6;
  const priorMean = 0.60; // 60% consistente em toda a etapa 1
  const bayesianAccuracy =
    ((effectiveQCorrect + priorWeight * priorMean) / (effectiveQTotal + priorWeight)) * 100;

  const blendedAccuracy =
    ewmaAccuracy !== null
      ? bayesianAccuracy * 0.62 + ewmaAccuracy * 0.38
      : bayesianAccuracy;

  // Fator de credibilidade contínuo N / (N + 10) em vez de corte linear abrupto
  const confidenceFactor = effectiveQTotal / (effectiveQTotal + 10);
  const perfComponent = confidenceFactor * blendedAccuracy + (1 - confidenceFactor) * 60;

  // 2. COMPONENTE SUBJETIVO NÃO-LINEAR + ESFORÇO ATIVO (Retornos Decrescentes) + ESPAÇAMENTO LOGARÍTMICO
  // Evita que D=0 e M=0 gere armazenamento zero; modela interação Domínio vs Facilidade
  const masteryNorm = mastery / 5; // 0..1
  const easeNorm = (5 - difficulty) / 5; // 0..1
  const subjComponent = clamp(
    (masteryNorm * 0.72 + easeNorm * 0.28) * 100,
    12,
    100
  );

  // Retornos decrescentes com raiz quadrada (valoriza primeiras horas/questões, mas continua crescendo até 4h e 60 questões)
  const hoursScore = Math.min(1, Math.sqrt(activeWeightedHours / 3.2)) * 50;
  const questionsVolumeScore = Math.min(1, Math.sqrt(effectiveQTotal / 50)) * 50;
  const effortComponent = clamp(hoursScore + questionsVolumeScore, 0, 100);

  // Curva logarítmica para espaçamento K (continua premiando K > 4 dias distintos sem saturar abruptamente)
  const spacingComponent = clamp(Math.min(100, 38 * Math.log(1 + distinctStudyDays)), 0, 100);

  // Score Base de Armazenamento (Storage Strength S_base)
  let baseScoreRaw =
    perfComponent * 0.64 +
    subjComponent * 0.16 +
    effortComponent * 0.12 +
    spacingComponent * 0.08;

  if (isCompletedFlag && baseScoreRaw < 55 && studyQTotal === 0) {
    baseScoreRaw = Math.max(baseScoreRaw, 58);
  }

  const baseScore = Math.round(clamp(baseScoreRaw, 15, 100));

  // 3. MODELO DE MEMÓRIA FSRS-4.5 PURO E CONSISTENTE
  // Dificuldade cognitiva afeta a estabilidade (Importância na prova NÃO acelera o esquecimento cognitivo, apenas eleva R_target e Prioridade!)
  const now = new Date();
  const lastStudyDate =
    sortedRecords.length > 0 ? parseLocalDate(sortedRecords[sortedRecords.length - 1].date) : now;
  const daysSinceLastStudy = Math.max(
    0,
    Math.floor((now.getTime() - lastStudyDate.getTime()) / MS_PER_DAY)
  );

  const lambda0 = 0.024;
  const diffFactor = clamp(1 + 0.14 * (difficulty - 2.5), 0.72, 1.40);
  const masteryDecayFactor = clamp(1.26 - 0.84 * (baseScore / 100), 0.36, 1.25);
  // Amortecimento exponencial suave por repetições espaçadas K
  const spacingDecayDampener = 1 / (1 + 0.32 * Math.max(0, distinctStudyDays - 1));
  const recentLapsePenalty =
    lastSessionAccuracy !== null && lastSessionAccuracy < 55 ? 1.30 : 1.0;

  const rawLambda =
    (lambda0 * diffFactor * masteryDecayFactor * spacingDecayDampener * recentLapsePenalty) /
    userRetentionMultiplier;
  const lambda = clamp(rawLambda, 0.0025, 0.095);

  // Estabilidade S (em dias): tempo exato para a retenção cair de 100% para 90%
  const memoryStabilityDays = Number(clamp(-Math.log(0.9) / lambda, 1.2, 120).toFixed(1));

  // Curva FSRS-4.5 Pura e Consistente: R(t) = (1 + (19/81) * (t / S))^(-0.5)
  // Nota: em t = S, R(S) = (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 9/10 = 90%!
  const retentionRaw = Math.pow(
    1 + (19 / 81) * (daysSinceLastStudy / memoryStabilityDays),
    -0.5
  );
  const retention = Math.round(clamp(retentionRaw * 100, 15, 100));

  // Perda percentual diária média nos primeiros dias (para leitura humana intuitiva)
  const rDay1 = Math.pow(1 + (19 / 81) * (1 / memoryStabilityDays), -0.5);
  const dailyDecayPercent = Number(clamp((1 - rDay1) * 100, 0.2, 12.0).toFixed(1));

  // Score Atual (combina Força de Armazenamento S_base e Força de Recuperação R(t) - Bjork 1994)
  const currentScore = Math.round(
    clamp(baseScore * (0.35 + 0.65 * (retention / 100)), 10, 100)
  );

  // 4. AGENDAMENTO ANALÍTICO CONSISTENTE FSRS-4.5 + CENSURA POR DATA DA PROVA
  // Limiar de Retenção Alvo (R_target): tópicos de alta importância (I=4,5) são revisados antes da retenção cair muito (82%-86%)
  const targetRetention = clamp(
    0.80 + 0.016 * (importance - 3) - 0.035 * ((baseScore - 50) / 50),
    0.75,
    0.86
  );

  // Inversão Analítica Exata da curva FSRS-4.5: R(t) = R_target <=> t = S * (81/19) * (R_target^(-2) - 1)
  let rawIntervalDays = Math.round(
    memoryStabilityDays * (81 / 19) * (Math.pow(targetRetention, -2) - 1)
  );

  if (lastSessionAccuracy !== null && lastSessionAccuracy < 45) {
    rawIntervalDays = Math.min(rawIntervalDays, 3);
  } else if (currentScore < 45) {
    rawIntervalDays = Math.min(rawIntervalDays, 5);
  }

  let nextReviewDays = clamp(rawIntervalDays, 1, 90);

  // Censura pelo Horizonte da Prova (Exam Date Censoring): se houver prova marcada e o tópico for importante, garante revisão antes da prova!
  if (examDate) {
    const examDt = parseLocalDate(examDate);
    const daysToExam = Math.floor((examDt.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysToExam >= 2 && daysToExam < nextReviewDays && importance >= 3) {
      nextReviewDays = Math.max(1, daysToExam - 1);
    }
  }

  const nextDateObj = new Date(lastStudyDate.getTime() + nextReviewDays * MS_PER_DAY);
  const nextReviewDate = formatYMD(nextDateObj);

  // 5. KRONO PRIORITY ENGINE (ROI de Pontos na Prova: 0 - 100)
  // Responde: "Qual tópico merece minha próxima hora de estudo para maximizar minha nota na prova?"
  const importanceWeight = 0.4 + (importance / 5) * 0.9; // 0.40 a 1.30
  const masteryGap = 100 - currentScore; // Potencial de ganho de domínio
  const forgettingUrgency = 100 - retention; // Urgência de recuperação na memória
  const lowSampleBoost = studyQTotal < 15 ? (15 - studyQTotal) * 1.1 : 0;
  const priorityROI = clamp(
    Math.round(
      importanceWeight * (masteryGap * 0.55 + forgettingUrgency * 0.35 + lowSampleBoost)
    ),
    5,
    99
  );

  const level: TopicScoreResult['level'] =
    currentScore >= 75 ? 'strong' : currentScore >= 50 ? 'medium' : 'weak';

  const accText =
    rawAccuracy !== null
      ? `${studyQCorrect}/${studyQTotal} questões (${Math.round(rawAccuracy)}%)`
      : 'sem questões registradas';

  const explanation = `Score ${currentScore}/100 (Base ${baseScore}, Retenção ${retention}%, ROI ${priorityROI}%). Estabilidade S: ${memoryStabilityDays}d (-${dailyDecayPercent}%/dia). Baseado em ${accText}, ${distinctStudyDays} dia(s) de estudo, Relevância ${importance}/5, Dificuldade ${difficulty}/5 e Domínio ${mastery}/5 -> próxima revisão FSRS em +${nextReviewDays} dias.`;

  const detailedFormulaSteps = [
    `1. Desempenho Bayesiano + EWMA: ${studyQCorrect}/${studyQTotal} questões no tópico + peso proporcional de simulados -> Acurácia suavizada de ${Math.round(blendedAccuracy)}% (Credibilidade amostral: ${Math.round(confidenceFactor * 100)}%).`,
    `2. Score Base de Armazenamento (${baseScore}/100): Combina Desempenho (${Math.round(perfComponent)}), Domínio vs. Dificuldade (${Math.round(subjComponent)}), Esforço Ativo Ponderado (${Math.round(effortComponent)}) e Espaçamento Logarítmico (${distinctStudyDays} dias).`,
    `3. Memória FSRS-4.5 (Estabilidade S = ${memoryStabilityDays} dias | -${dailyDecayPercent}%/dia): Após ${daysSinceLastStudy} dia(s) sem contato, a Retenção ativa é de ${retention}%.`,
    `4. Agendamento FSRS-4.5 & Prioridade (ROI ${priorityROI}/100): Revisão agendada para quando a retenção atingir ${Math.round(targetRetention * 100)}%, resultando em +${nextReviewDays} dias (${nextReviewDate}).`,
  ];

  // DIAGNÓSTICO TRANSPARENTE DE FATORES QUE IMPACTAM O SCORE
  const impactFactors: ScoreImpactFactor[] = [];

  if (studyQTotal === 0) {
    impactFactors.push({
      type: 'negative',
      label: 'Nenhuma questão registrada neste tópico',
      detail:
        'Sem questões, a credibilidade estatística fica baixa e o Score ancora em 60%. Resolva ao menos 10 a 20 questões para destravar o Score.',
    });
  } else if (studyQTotal < 15) {
    impactFactors.push({
      type: 'neutral',
      label: `Amostra em construção (${studyQTotal} questões resolvidas)`,
      detail: `Credibilidade estatística atual em ${Math.round(confidenceFactor * 100)}%. O motor suaviza extremos (Bayes/EWMA) até você acumular mais questões.`,
    });
  } else if (rawAccuracy !== null && rawAccuracy >= 80) {
    impactFactors.push({
      type: 'positive',
      label: `Excelente taxa de acerto (${Math.round(rawAccuracy)}% em ${studyQTotal} questões)`,
      detail: 'Alto volume com ótimo desempenho eleva fortemente o seu Score Base e a estabilidade da memória (S).',
    });
  } else if (rawAccuracy !== null && rawAccuracy < 60) {
    impactFactors.push({
      type: 'negative',
      label: `Taxa de acerto baixa (${Math.round(rawAccuracy)}% em ${studyQTotal} questões)`,
      detail: 'Os erros registrados indicam lacuna na base ou pegadinhas recorrentes, reduzindo o Score e antecipando a revisão.',
    });
  }

  if (lastSessionAccuracy !== null && studyQTotal >= 5) {
    if (lastSessionAccuracy < 55) {
      impactFactors.push({
        type: 'negative',
        label: `Alerta na última bateria (${Math.round(lastSessionAccuracy)}% de acerto)`,
        detail: 'O lapso recente ativou o encurtamento pós-erro do FSRS para você corrigir as falhas rapidamente.',
      });
    } else if (lastSessionAccuracy >= 85) {
      impactFactors.push({
        type: 'positive',
        label: `Última sessão muito forte (${Math.round(lastSessionAccuracy)}% de acerto)`,
        detail: 'A tendência recente (EWMA) impulsionou positivamente o seu Score e espaçou a próxima revisão.',
      });
    }
  }

  if (difficulty >= 4 || mastery <= 2) {
    impactFactors.push({
      type: 'negative',
      label: `Tópico desafiador (Dificuldade ${difficulty}/5 • Domínio ${mastery}/5)`,
      detail: 'Maior dificuldade pessoal reduz a Estabilidade inicial (S), exigindo mais repetições até consolidar.',
    });
  } else if (mastery >= 4 && difficulty <= 2) {
    impactFactors.push({
      type: 'positive',
      label: `Segurança declarada alta (Domínio ${mastery}/5 • Dificuldade ${difficulty}/5)`,
      detail: 'Sua facilidade no assunto aumenta a Estabilidade da Memória (S) e desacelera a queda diária.',
    });
  }

  if (importance >= 4) {
    impactFactors.push({
      type: 'neutral',
      label: `Alta Relevância na Prova (${importance}/5) • Prioridade ROI: ${priorityROI}/100`,
      detail: `Por cair muito na prova, o motor exige retenção-alvo mais alta (${Math.round(targetRetention * 100)}%) antes de você esquecer.`,
    });
  }

  if (daysSinceLastStudy >= 7 && retention < 82) {
    impactFactors.push({
      type: 'negative',
      label: `Desgaste pelo tempo (${daysSinceLastStudy} dias sem contato -> Retenção ${retention}%)`,
      detail: `Seu Score Base é ${baseScore}, mas o tempo sem revisar reduziu o Score atual para ${currentScore}.`,
    });
  } else if (distinctStudyDays >= 3) {
    impactFactors.push({
      type: 'positive',
      label: `Memória consolidada em ${distinctStudyDays} dias distintos (S = ${memoryStabilityDays}d)`,
      detail: 'O espaçamento entre sessões multiplicou sua Força de Armazenamento.',
    });
  }

  // 6. ÁRVORE DE DECISÃO COMPLETA DE DICA CIENTÍFICA DE REVISÃO (Sem lacunas)
  let scientificReviewTip: ScientificReviewTip;

  if (currentScore < 52 || (lastSessionAccuracy !== null && lastSessionAccuracy < 55)) {
    scientificReviewTip = {
      badge: 'Score Baixo • Scaffolding + Recuperação Guiada',
      title: 'Consulta Direcionada (15 min) + 15 Questões Comentadas',
      description:
        'Seu desempenho recente indica lacunas conceituais. Consulte os pontos críticos da teoria/lei seca por 15 min e faça 15 questões comentadas mapeando o motivo de cada erro.',
      actionType: 'theory_questions',
    };
  } else if (baseScore >= 75 && retention < 78 && hasSavedNotes) {
    scientificReviewTip = {
      badge: 'Boa Base + Queda Temporal • Flash Scan + Prática',
      title: 'Leitura Flash das suas Notas na Plataforma (5 min) + 15 Questões',
      description: `Você construiu ótima base (${baseScore}/100), mas está há ${daysSinceLastStudy} dias sem ver o tópico (Retenção ${retention}%). Passe 5 min nas suas Anotações salvas aqui e resolva 15 questões.`,
      actionType: 'notes_scan_questions',
    };
  } else if (currentScore >= 75 && retention >= 78) {
    scientificReviewTip = {
      badge: 'Tópico Consolidado • Manutenção Rápida (Testing Effect)',
      title: 'Bateria Rápida de Manutenção (10 a 15 Questões Diretas)',
      description:
        'Não releia a teoria passivamente (evite a ilusão de competência). Faça apenas 10 a 15 questões rápidas em ritmo de prova para manter a estabilidade elevada.',
      actionType: 'fast_maintenance',
    };
  } else {
    // Cobre todos os casos intermediários (52 <= Score < 75, ou Score >= 75 com R < 78 sem notas próprias)
    scientificReviewTip = {
      badge: 'Consolidação Ativa • Active Recall Puro (Dunlosky / Bjork)',
      title: 'Resolver 15 a 25 Questões ANTES de olhar a Teoria/Notas',
      description:
        'A ciência cognitiva prova que tentar recuperar a informação da memória antes de reler fortalece a sinapse (Desirable Difficulty). Vá direto para o Caderno de Questões e só consulte a teoria/notas nos itens que errar.',
      actionType: 'active_recall_questions',
    };
  }

  return {
    score: currentScore,
    baseScore,
    retention,
    priorityROI,
    level,
    nextReviewDays,
    nextReviewDate,
    daysSinceLastStudy,
    distinctStudyDays,
    totalQuestions: studyQTotal,
    correctQuestions: studyQCorrect,
    rawAccuracy,
    smoothedAccuracy: Math.round(blendedAccuracy),
    lastSessionAccuracy: lastSessionAccuracy !== null ? Math.round(lastSessionAccuracy) : null,
    totalHours,
    importance,
    difficulty,
    mastery,
    lambda: Number(lambda.toFixed(4)),
    memoryStabilityDays,
    dailyDecayPercent,
    calibrationBias,
    explanation,
    detailedFormulaSteps,
    impactFactors,
    scientificReviewTip,
  };
}

/**
 * Calcula o Score Geral da Disciplina (0-100) e a Retenção Média da Disciplina,
 * integrando todos os tópicos estudados + todos os Simulados cadastrados.
 */
export function computeSubjectScore(params: {
  subject: EditalSubject | any;
  studyRecords: StudyRecord[];
  simuladoRecords?: SimuladoRecord[];
  userRetentionMultiplier?: number;
}): SubjectScoreResult {
  const {
    subject,
    studyRecords,
    simuladoRecords = [],
    userRetentionMultiplier = 1.0,
  } = params;

  const subjectName = subject?.subject || '';

  const flattenLeaves = (topics: any[]): any[] => {
    let leaves: any[] = [];
    for (const t of topics || []) {
      if (t.sub_topics && t.sub_topics.length > 0) {
        leaves = leaves.concat(flattenLeaves(t.sub_topics));
      } else {
        leaves.push(t);
      }
    }
    return leaves;
  };

  const leafTopics = flattenLeaves(subject?.topics || []);
  const totalTopics = leafTopics.length;

  let weightedScoreSum = 0;
  let weightedRetentionSum = 0;
  let weightTotal = 0;
  let topicsEvaluated = 0;

  for (const t of leafTopics) {
    const res = computeTopicScore({
      topic: t,
      subjectName,
      studyRecords,
      simuladoRecords,
      subjectTopicsCount: Math.max(1, totalTopics),
      userRetentionMultiplier,
    });
    if (res.level !== 'unstarted') {
      const w = clamp(res.importance, 1, 5);
      weightedScoreSum += res.score * w;
      weightedRetentionSum += res.retention * w;
      weightTotal += w;
      topicsEvaluated++;
    }
  }

  const subjectRecords = (studyRecords || []).filter((r) => r.subject === subjectName);
  let studyQTotal = 0;
  let studyQCorrect = 0;
  let latestStudyMs = 0;

  for (const r of subjectRecords) {
    studyQTotal += r.questions?.total || 0;
    studyQCorrect += r.questions?.correct || 0;
    const tMs = parseLocalDate(r.date).getTime();
    if (tMs > latestStudyMs) latestStudyMs = tMs;
  }

  let simQTotal = 0;
  let simQCorrect = 0;
  for (const sim of simuladoRecords || []) {
    for (const sSub of sim.subjects || []) {
      if (sSub.subjectName?.toLowerCase() === subjectName?.toLowerCase()) {
        simQTotal += sSub.totalQuestions || 0;
        simQCorrect += sSub.correct || 0;
        const tMs = parseLocalDate(sim.date).getTime();
        if (tMs > latestStudyMs) latestStudyMs = tMs;
      }
    }
  }

  const combinedTotal = studyQTotal + simQTotal;
  const combinedCorrect = studyQCorrect + simQCorrect;
  const combinedAccuracy =
    combinedTotal > 0 ? Math.round((combinedCorrect / combinedTotal) * 100) : null;

  const daysSinceLastStudy =
    latestStudyMs > 0
      ? Math.max(0, Math.floor((Date.now() - latestStudyMs) / MS_PER_DAY))
      : 0;

  let avgTopicScore = weightTotal > 0 ? weightedScoreSum / weightTotal : 0;
  const avgTopicRetention = weightTotal > 0 ? weightedRetentionSum / weightTotal : 0;

  if (simQTotal > 0) {
    const simAcc = (simQCorrect / simQTotal) * 100;
    const simConfidence = Math.min(0.3, (simQTotal / 40) * 0.3);
    avgTopicScore =
      topicsEvaluated > 0
        ? avgTopicScore * (1 - simConfidence) + simAcc * simConfidence
        : simAcc * 0.85;
  }

  const subjectScore = Math.round(clamp(avgTopicScore, 0, 100));
  const subjectRetention = Math.round(
    clamp(
      topicsEvaluated > 0
        ? avgTopicRetention
        : latestStudyMs > 0
        ? Math.pow(1 + (19 / 81) * (daysSinceLastStudy / 10), -0.5) * 100
        : 0,
      0,
      100
    )
  );

  const explanation =
    topicsEvaluated > 0 || simQTotal > 0
      ? `Score da Disciplina ${subjectScore}/100 • Retenção Média ${subjectRetention}% (${topicsEvaluated}/${totalTopics} tópicos avaliados, ${studyQTotal} questões em estudo + ${simQTotal} em simulados).`
      : 'Disciplina ainda sem tópicos avaliados ou simulados registrados.';

  return {
    subjectScore,
    subjectRetention,
    topicsEvaluated,
    totalTopics,
    studyQuestionsTotal: studyQTotal,
    studyQuestionsCorrect: studyQCorrect,
    simuladoQuestionsTotal: simQTotal,
    simuladoQuestionsCorrect: simQCorrect,
    combinedAccuracy,
    daysSinceLastStudy,
    explanation,
  };
}

/**
 * Utilitário para buscar um objeto de tópico dentro da estrutura do edital (stats.editalData ou plan.subjects)
 */
export function findTopicObjectInEdital(
  editalSubjects: any[] | undefined,
  subjectName: string,
  topicText: string
): any | null {
  if (!editalSubjects || !subjectName || !topicText) return null;
  const subj = editalSubjects.find(
    (s: any) => s.subject?.toLowerCase() === subjectName?.toLowerCase()
  );
  if (!subj || !subj.topics) return null;

  const searchTree = (topics: any[]): any | null => {
    for (const t of topics) {
      if (t.topic_text === topicText) return t;
      if (t.sub_topics && t.sub_topics.length > 0) {
        const found = searchTree(t.sub_topics);
        if (found) return found;
      }
    }
    return null;
  };

  return searchTree(subj.topics);
}

/**
 * Retorna a URL formatada do Caderno de Questões de um tópico específico, se houver cadastrado.
 */
export function findTopicNotebookUrl(
  editalSubjects: any[] | undefined,
  subjectName: string,
  topicText: string
): string | null {
  const topicObj = findTopicObjectInEdital(editalSubjects, subjectName, topicText);
  const rawUrl = topicObj?.notebookUrl ? String(topicObj.notebookUrl).trim() : '';
  if (!rawUrl) return null;
  return rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : `https://${rawUrl}`;
}
