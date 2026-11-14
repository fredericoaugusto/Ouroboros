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
  currentScore: number; // alias para score (0 a 100)
  baseScore: number; // 0 - 100 (Força de Armazenamento / Qualidade de Aprendizagem antes do decaimento)
  retention: number; // 0 - 100 (%) - Probabilidade estimada de recordação hoje (FSRS-4.5)
  urgencyScore?: number; // 0 - 100 - Urgência temporal de revisão (retenção + importância + proximidade da prova)
  priorityROI: number; // 0 - 100 - Krono Priority Engine: Retorno esperado de pontos por hora investida
  level: 'strong' | 'medium' | 'weak' | 'unstarted' | 'high' | 'low';
  color: 'emerald' | 'amber' | 'rose';
  statusColor: 'green' | 'yellow' | 'red';
  nextReviewDays: number; // Dias recomendados a partir do último estudo (inversão analítica exata FSRS-4.5)
  reviewIntervalDays: number; // alias
  nextReviewDate: string | null; // YYYY-MM-DD
  daysUntilReview: number;
  isDueForReview: boolean;
  forgettingPenalty: number;
  daysSinceLastStudy: number;
  distinctStudyDays: number;
  totalQuestions: number;
  correctQuestions: number;
  rawAccuracy: number | null;
  lastStudyDate: string | null;
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

export interface SmartSessionReviewEstimate {
  days: number;
  tierLabel: string;
  tierColor: 'rose' | 'amber' | 'emerald' | 'indigo';
  reason: string;
  sessionAccuracyPct: number | null;
  baseScore: number;
  finalScore: number;
  explanation: string;
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
  combinedAccuracyPct: number | null;
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
export function computeTopicScore(
  inputOrParams: any,
  relevanceArg?: number,
  difficultyArg?: number,
  masteryArg?: number,
  extraArg?: any
): TopicScoreResult {
  let topic: any = null;
  let subjectName = '';
  let topicRecords: StudyRecord[] = [];
  let simuladoRecords: SimuladoRecord[] = [];
  let subjectTopicsCount = 10;
  let userRetentionMultiplier = 1.0;
  let examDate: string | null = null;
  let isCompletedFlag = false;
  let hasSavedNotes = false;

  if (Array.isArray(inputOrParams)) {
    // Chamada posicional com array de registros já pertencentes a este tópico
    topicRecords = inputOrParams;
    const importance = clamp(Number(relevanceArg ?? 3), 0, 5);
    const difficulty = clamp(Number(difficultyArg ?? 3), 0, 5);
    const mastery = clamp(Number(masteryArg ?? 3), 0, 5);
    subjectName = extraArg?.subjectName || topicRecords[0]?.subject || '';
    simuladoRecords = extraArg?.simuladoRecords || [];
    hasSavedNotes = Boolean(extraArg?.hasNotes);
    isCompletedFlag = Boolean(extraArg?.isCompleted);

    topic = {
      topic_text: extraArg?.topicText || topicRecords[0]?.topic || 'Tópico',
      importance,
      difficulty,
      mastery,
      userWeight: importance,
      is_completed: isCompletedFlag,
      notes: hasSavedNotes ? 'Anotações salvas' : undefined,
    };
  } else if (inputOrParams && (inputOrParams.topic || inputOrParams.studyRecords)) {
    // Chamada por objeto de parâmetros
    topic = inputOrParams.topic;
    subjectName = inputOrParams.subjectName || topic?.subject || '';
    const allRecords: StudyRecord[] = inputOrParams.studyRecords || [];
    simuladoRecords = inputOrParams.simuladoRecords || [];
    subjectTopicsCount = inputOrParams.subjectTopicsCount || 10;
    userRetentionMultiplier = inputOrParams.userRetentionMultiplier || 1.0;
    examDate = inputOrParams.examDate || null;
    isCompletedFlag = Boolean(
      topic?.is_completed || topic?.status === 'completed' || topic?.status === 'studied'
    );
    hasSavedNotes = Boolean(
      topic?.notes && String(topic.notes).replace(/<[^>]*>/g, '').trim().length > 15
    );

    const topicText = (topic?.topic_text || '').trim().toLowerCase();
    const cleanSubj = (subjectName || '').trim().toLowerCase();
    topicRecords = allRecords.filter((r) => {
      const rSubj = (r.subject || '').trim().toLowerCase();
      const rTopic = (r.topic || '').trim().toLowerCase();
      const subjMatch = !cleanSubj || rSubj === cleanSubj;
      const topicMatch =
        rTopic === topicText ||
        (rTopic.length > 5 && (rTopic.endsWith(topicText) || topicText.endsWith(rTopic))) ||
        (rTopic.length > 8 && (rTopic.includes(topicText) || topicText.includes(rTopic)));
      return subjMatch && topicMatch;
    });
  } else if (inputOrParams) {
    // Objeto simples do tipo TopicScoreInput
    const inp = inputOrParams;
    const importance = clamp(Number(inp.relevance ?? 3), 0, 5);
    const difficulty = clamp(Number(inp.difficulty ?? 3), 0, 5);
    const mastery = clamp(Number(inp.perceivedMastery ?? 3), 0, 5);
    subjectName = inp.subject || '';
    topic = {
      topic_text: inp.topic || 'Tópico',
      importance,
      difficulty,
      mastery,
      userWeight: importance,
    };
    if (inp.questionsTotal !== undefined) {
      topicRecords = [
        {
          id: 'single-input',
          date: inp.lastStudiedDate || formatYMD(new Date()),
          subjectId: '',
          subject: subjectName,
          topic: topic.topic_text,
          studyTime: 3600000,
          questions: {
            correct: inp.questionsCorrect || 0,
            total: inp.questionsTotal || 0,
          },
          pages: [],
          videos: [],
          notes: '',
          category: 'questoes',
          teoriaFinalizada: false,
          countInPlanning: true,
        },
      ];
    }
  }

  const importance = clamp(Number(topic?.importance ?? topic?.userWeight ?? 3), 0, 5);
  const difficulty = clamp(Number(topic?.difficulty ?? 3), 0, 5);
  const mastery = clamp(Number(topic?.mastery ?? 3), 0, 5);

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

  // Filtra registros vazios ("fantasmas" de checkbox desmarcado com 0 min, 0 questões e teoriaFinalizada=false)
  topicRecords = (topicRecords || []).filter(
    (r) =>
      (r.studyTime || 0) > 0 ||
      (r.questions?.total || 0) > 0 ||
      Boolean(r.teoriaFinalizada) ||
      Boolean(r.notes && String(r.notes).trim().length > 0)
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
      currentScore: 0,
      baseScore: subjPrior,
      retention: 0,
      priorityROI: unstartedROI,
      level: 'unstarted',
      color: 'amber',
      statusColor: 'yellow',
      nextReviewDays: 0,
      reviewIntervalDays: 0,
      nextReviewDate: null,
      daysUntilReview: 0,
      isDueForReview: false,
      forgettingPenalty: 0,
      daysSinceLastStudy: 0,
      distinctStudyDays: 0,
      totalQuestions: 0,
      correctQuestions: 0,
      rawAccuracy: null,
      lastStudyDate: null,
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

  // 1. DESEMPENHO BAYESIANO FORMALIZADO + EWMA PONDERADO POR CREDIBILIDADE DA SESSÃO (Krono v3.2)
  // Nota sobre Simulados (v3.2): só aplica leve prior da disciplina com decaimento temporal quando o tópico
  // possui poucas questões diretas (N < 15), evitando rateio artificial permanente entre tópicos.
  const simBlendFactor = studyQTotal < 15 ? Math.max(0, (15 - studyQTotal) / 15) * 0.35 : 0;
  const effectiveQTotal = studyQTotal + simQuestionsForTopic * simBlendFactor;
  const effectiveQCorrect = studyQCorrect + simCorrectForTopic * simBlendFactor;
  const rawAccuracy = studyQTotal > 0 ? (studyQCorrect / studyQTotal) * 100 : null;

  // Prior Bayesiano de referência (W0 = 8, p0 = 0.60)
  const priorWeight = 8.0;
  const priorMean = 0.60;
  const bayesianAccuracy =
    ((effectiveQCorrect + priorWeight * priorMean) / (effectiveQTotal + priorWeight)) * 100;

  // EWMA ponderado pela credibilidade do tamanho de cada bateria: c_k = 1 - e^(-N_k / 5)
  // Inicialização: A_ewma^(0) = A_bayes
  let ewmaAccState = bayesianAccuracy;
  if (recordsWithQuestions.length > 0) {
    const lastQRec = recordsWithQuestions[recordsWithQuestions.length - 1];
    lastSessionAccuracy =
      ((lastQRec.questions?.correct || 0) / (lastQRec.questions?.total || 1)) * 100;

    const alphaEwma = 0.45;
    for (let i = 0; i < recordsWithQuestions.length; i++) {
      const rec = recordsWithQuestions[i];
      const nK = Math.max(1, rec.questions?.total || 1);
      const sessAcc = ((rec.questions?.correct || 0) / nK) * 100;
      const cK = 1 - Math.exp(-nK / 5);
      const sessAdjusted = cK * sessAcc + (1 - cK) * bayesianAccuracy;
      ewmaAccState = alphaEwma * sessAdjusted + (1 - alphaEwma) * ewmaAccState;

      if (i > 0) {
        const prevRec = recordsWithQuestions[i - 1];
        const gap = Math.max(
          1,
          Math.round(
            (parseLocalDate(rec.date).getTime() - parseLocalDate(prevRec.date).getTime()) /
              MS_PER_DAY
          )
        );
        if (gap >= 2 && nK >= 3) {
          const predR = Math.pow(1 + (19 / 81) * (gap / 12), -0.5) * 100;
          calibrationErrors.push(sessAcc - predR);
        }
      }
    }
    ewmaAccuracy = ewmaAccState;
  }

  const calibrationBias =
    calibrationErrors.length > 0
      ? Math.round(
          calibrationErrors.reduce((a, b) => a + b, 0) / calibrationErrors.length
        )
      : null;

  // Credibilidade global das evidências objetivas: C_N = N_eff / (N_eff + 10)
  const confidenceFactor =
    effectiveQTotal > 0 ? effectiveQTotal / (effectiveQTotal + 10) : 0;
  const combinedAccuracy = 0.70 * bayesianAccuracy + 0.30 * ewmaAccState;
  const perfComponent = clamp(
    confidenceFactor * combinedAccuracy + (1 - confidenceFactor) * (priorMean * 100),
    0,
    100
  );

  // 2. DOMÍNIO SUBJETIVO PURO (Separado da Dificuldade Estrutural!) + SOMA EXATA DE PESOS = 100% (v3.2)
  // w_subj = 0.16 * e^(-N_eff / 40)
  // w_perf = 0.78 - w_subj
  // w_prog = 0.12 | w_cons = 0.10 => w_perf + w_subj + 0.12 + 0.10 = 1.00 (100% exato!)
  const subjectiveWeight = 0.16 * Math.exp(-effectiveQTotal / 40);
  const performanceWeight = 0.78 - subjectiveWeight;

  // Em v3.2, P_subj reflete exclusivamente o domínio percebido pelo aluno (M/5 * 100),
  // sem penalizar quem tem domínio 5 em um assunto estruturalmente difícil (D=5).
  const subjComponent = clamp((mastery / 5) * 100, 10, 100);

  // 3. PROGRESSO OPERACIONAL DE ESTUDO (P_prog, peso 12%) — Sem dupla contagem de questões (N_eff)!
  // Mede horas ativas dedicadas + conclusão da teoria + diversidade de modalidades (teoria, prática, revisão/notas)
  const cappedActiveHours = sortedRecords.reduce((acc, r) => {
    const h = Math.min(2.5, (r.studyTime || 0) / 3600000);
    const mult =
      r.category === 'questoes' || r.category === 'revisao'
        ? 1.25
        : r.category === 'leitura_lei' || r.category === 'jurisprudencia'
        ? 1.05
        : 0.85;
    return acc + h * mult;
  }, 0);
  const hasTheoryActivity =
    isCompletedFlag || sortedRecords.some((r) => r.category === 'teoria' || r.category === 'leitura_lei');
  const hasPracticeActivity = studyQTotal > 0 || sortedRecords.some((r) => r.category === 'questoes');
  const hasReviewOrNotesActivity =
    hasSavedNotes || sortedRecords.some((r) => r.category === 'revisao' || r.category === 'jurisprudencia');
  const modalitiesCount =
    (hasTheoryActivity ? 1 : 0) + (hasPracticeActivity ? 1 : 0) + (hasReviewOrNotesActivity ? 1 : 0);

  const hoursProgress = Math.min(55, 28 * Math.sqrt(cappedActiveHours));
  const theoryCompletionBonus = isCompletedFlag ? 20 : 0;
  const modalityDiversityBonus = (modalitiesCount / 3) * 25;
  const progressComponent = clamp(
    hoursProgress + theoryCompletionBonus + modalityDiversityBonus,
    15,
    100
  );

  // 4. CONSISTÊNCIA EM JANELA MÓVEL DE 30 DIAS (P_cons, peso 10%) — Sobe e desce conforme regularidade recente!
  const now = new Date();
  const lastStudyDate =
    sortedRecords.length > 0 ? parseLocalDate(sortedRecords[sortedRecords.length - 1].date) : now;
  const daysSinceLastStudy = Math.max(
    0,
    Math.floor((now.getTime() - lastStudyDate.getTime()) / MS_PER_DAY)
  );

  let distinctDaysLast30d = 0;
  uniqueDates.forEach((dStr) => {
    const dObj = parseLocalDate(dStr);
    const diffDays = Math.max(0, (now.getTime() - dObj.getTime()) / MS_PER_DAY);
    if (diffDays <= 30) {
      distinctDaysLast30d += 1;
    }
  });

  const rolling30dConsistency = (1 - Math.exp(-distinctDaysLast30d / 3.0)) * 85;
  const historicalAnchorConsistency = (1 - Math.exp(-distinctStudyDays / 6.0)) * 15;
  const consistencyComponent = clamp(rolling30dConsistency + historicalAnchorConsistency, 10, 100);

  // Score Base (B_score = w_perf * P_perf + w_subj * P_subj + 0.12 * P_prog + 0.10 * P_cons; Soma de pesos = 100%)
  let baseScoreRaw =
    effectiveQTotal > 0
      ? perfComponent * performanceWeight +
        subjComponent * subjectiveWeight +
        progressComponent * 0.12 +
        consistencyComponent * 0.10
      : subjComponent * 0.55 + progressComponent * 0.27 + consistencyComponent * 0.18;

  if (isCompletedFlag && baseScoreRaw < 62 && studyQTotal === 0) {
    baseScoreRaw = Math.max(baseScoreRaw, 62);
  }

  const baseScore = Math.round(clamp(baseScoreRaw, 10, 100));

  // 5. MOTOR DE MEMÓRIA KRONO v3.2:
  // - Agrupamento diário consolidado (evita inflar S com múltiplas sessões no mesmo dia)
  // - Separação estrita entre Recuperação Ativa (questões/revisão) e Exposição Passiva (teoria/leitura)
  // - Separação entre D_topic (dificuldade estrutural do assunto) e D_memory (dificuldade empírica de recuperação)
  const dayGroups = new Map<
    string,
    { dateObj: Date; qTotal: number; qCorrect: number; mins: number; activeRecall: boolean }
  >();
  for (const r of sortedRecords) {
    const key = (r.date || '').split('T')[0];
    if (!key) continue;
    const prev = dayGroups.get(key) || {
      dateObj: parseLocalDate(r.date),
      qTotal: 0,
      qCorrect: 0,
      mins: 0,
      activeRecall: false,
    };
    prev.qTotal += r.questions?.total || 0;
    prev.qCorrect += r.questions?.correct || 0;
    prev.mins += (r.studyTime || 0) / 60000;
    if (r.category === 'questoes' || r.category === 'revisao' || (r.questions?.total || 0) > 0) {
      prev.activeRecall = true;
    }
    dayGroups.set(key, prev);
  }

  const orderedDays = Array.from(dayGroups.values()).sort(
    (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
  );

  // D_topic (1..5): dificuldade estrutural do assunto
  // D_memory (1..5): dificuldade empírica de recuperação na memória
  const dTopic = clamp(difficulty || 3, 1, 5);
  let dMemory = clamp(0.65 * dTopic + 0.35 * (6 - mastery), 1, 5);

  // Estabilidade inicial S0 conservadora (1.8 a 8.0 dias; exige revisão diagnóstica antes de intervalos longos)
  let S = clamp(
    2.2 + 0.9 * (mastery - 1) - 0.35 * (dTopic - 1),
    1.8,
    studyQTotal > 0 ? 8.5 : 5.5
  );

  for (let i = 0; i < orderedDays.length; i++) {
    const day = orderedDays[i];
    const deltaDays =
      i === 0
        ? 1.0
        : Math.max(0.1, (day.dateObj.getTime() - orderedDays[i - 1].dateObj.getTime()) / MS_PER_DAY);

    const rRev =
      i === 0 ? 0.90 : Math.pow(1 + (19 / 81) * (deltaDays / Math.max(1.0, S)), -0.5);

    if (day.activeRecall) {
      // A. SESSÃO COM RECUPERAÇÃO ATIVA (Questões / Revisão Ativa)
      // Qualidade da recuperação q_k in [0, 1] suavizada pelo tamanho da amostra do dia
      const qK =
        day.qTotal > 0
          ? clamp((day.qCorrect + 2.0 * 0.65) / (day.qTotal + 2.0), 0.05, 1.0)
          : clamp(0.55 + (mastery - 3) * 0.05, 0.45, 0.72);

      // Atualiza D_memory com base na recuperação observada (separada de D_topic!)
      const credDay = day.qTotal > 0 ? 1 - Math.exp(-day.qTotal / 6) : 0.35;
      dMemory = clamp(dMemory - 0.55 * credDay * (qK - 0.65), 1.0, 5.0);

      if (i === 0) {
        // Calibração da 1ª sessão ativa
        S = clamp(S * (0.80 + 0.45 * qK), 1.8, 12.0);
      } else {
        // Transição logística suave centrada em q = 0.60
        const wQ = 1 / (1 + Math.exp(-12 * (qK - 0.60)));
        const spacingFactor = Math.min(1.40, Math.log(1 + deltaDays) / Math.log(8));
        const difficultyFactor = 0.55 + 0.45 * ((5 - dMemory) / 4);
        const desirableBonus = 1 + 0.45 * Math.max(0, 0.90 - rRev) * wQ;

        // Ganho bruto sem piso mínimo artificial (max(0, G_raw))
        const gRaw = Math.max(
          0,
          0.62 * ((qK - 0.55) / 0.45) * spacingFactor * difficultyFactor * desirableBonus
        );
        const mSucc = 1 + gRaw;
        const mFail = clamp(0.45 + 0.40 * (qK / 0.60), 0.40, 0.92);

        const mTotal = (1 - wQ) * mFail + wQ * mSucc;
        S = clamp(S * mTotal, 1.5, 120);
      }
    } else {
      // B. SESSÃO EXCLUSIVAMENTE PASSIVA (Teoria / Leitura / Vídeo sem questões)
      // Não aplica multiplicador de recuperação ativa! Apenas preserva a codificação inicial se a memória estiver caindo.
      if (i > 0 && rRev < 0.85) {
        S = clamp(Math.min(S * 1.04, S + 0.35), 1.8, 120);
      }
    }
  }

  // Modula S pelo multiplicador pessoal de retenção calibrado empiricamente
  const memoryStabilityDays = Number(
    clamp(S * userRetentionMultiplier, 1.8, 120).toFixed(1)
  );
  const lambda = clamp(-Math.log(0.9) / memoryStabilityDays, 0.0022, 0.09);

  // Curva FSRS-4.5 Pura e Consistente: R(t) = (1 + (19/81) * (t / S))^(-0.5)
  const retentionRaw = Math.pow(
    1 + (19 / 81) * (daysSinceLastStudy / memoryStabilityDays),
    -0.5
  );
  const retention = Math.round(clamp(retentionRaw * 100, 10, 100));

  // Perda percentual diária média nos primeiros dias (para leitura humana intuitiva)
  const rDay1 = Math.pow(1 + (19 / 81) * (1 / memoryStabilityDays), -0.5);
  const dailyDecayPercent = Number(clamp((1 - rDay1) * 100, 0.2, 12.0).toFixed(1));

  // Score Atual (Krono Index): reflete o Domínio Consolidado (baseScore) modulado pela Retenção Atual
  const retentionWeightFactor =
    retention >= 55
      ? 0.65 + 0.35 * (retention / 100)
      : 0.35 + 0.89 * (retention / 100);
  const currentScore = Math.round(clamp(baseScore * retentionWeightFactor, 10, 100));

  // 6. AGENDAMENTO ANALÍTICO CONSISTENTE FSRS-4.5 + CENSURA POR DATA DA PROVA + PROTEÇÃO ESTATÍSTICA DE PÓS-LAPSO
  const targetRetention = clamp(
    0.85 + 0.015 * (importance - 3) + 0.01 * (dMemory - 3),
    0.80,
    0.92
  );

  // Inversão Analítica Exata da curva FSRS-4.5: R(t) = R_target <=> t = S * (81/19) * (R_target^(-2) - 1)
  let rawIntervalDays = Math.round(
    memoryStabilityDays * (81 / 19) * (Math.pow(targetRetention, -2) - 1)
  );

  // Exige 1ª revisão diagnóstica em até 7 dias enquanto não houver questões resolvidas
  const lastQSampleSize =
    recordsWithQuestions.length > 0
      ? recordsWithQuestions[recordsWithQuestions.length - 1].questions?.total || 0
      : 0;
  if (studyQTotal === 0) {
    rawIntervalDays = Math.min(rawIntervalDays, 7);
  } else if (lastSessionAccuracy !== null && lastSessionAccuracy < 50 && lastQSampleSize >= 5) {
    // Trava de pós-lapso com proteção estatística (amostra mínima N_last >= 5 questões)
    rawIntervalDays = Math.min(rawIntervalDays, 3);
  } else if (currentScore < 45) {
    rawIntervalDays = Math.min(rawIntervalDays, 5);
  }

  let nextReviewDays = clamp(rawIntervalDays, 1, 60);

  // Censura pelo Horizonte da Prova (Exam Date Censoring)
  let examUrgencyBoost = 1.0;
  if (examDate) {
    const examDt = parseLocalDate(examDate);
    const daysToExam = Math.floor((examDt.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysToExam >= 2 && daysToExam < nextReviewDays && importance >= 3) {
      nextReviewDays = Math.max(1, daysToExam - 1);
    }
    if (daysToExam > 0 && daysToExam <= 60) {
      examUrgencyBoost = 1 + 0.25 * ((60 - daysToExam) / 60);
    }
  }

  const nextDateObj = new Date(lastStudyDate.getTime() + nextReviewDays * MS_PER_DAY);
  const nextReviewDate = formatYMD(nextDateObj);

  // 7. KRONO PRIORITY ENGINE v3.2: Separação entre UrgencyScore e PriorityROI
  // A. UrgencyScore (0-100): Urgência temporal de revisão (queda de retenção + importância + atraso + proximidade da prova)
  const overdueRatio = clamp(daysSinceLastStudy / Math.max(1, nextReviewDays), 0, 2);
  const urgencyScore = clamp(
    Math.round(
      ((100 - retention) * 0.55 + overdueRatio * 25 + (importance / 5) * 20) * examUrgencyBoost
    ),
    5,
    99
  );

  // B. PriorityROI (0-100): Retorno esperado de pontos na prova por hora de estudo investida
  // P(cobrança_i) ~ (importance / 5)^1.20
  // Delta P(acerto_i) ~ margem de evolução esperada = (100 - currentScore) * (0.45 + 0.55 * (1 - confidenceFactor * 0.5))
  // Horas necessárias ~ esforço estimado combinando D_topic e lacuna atual
  const incidenceFactor = Math.pow(Math.max(1, importance) / 5, 1.20);
  const expectedAccuracyGain =
    (100 - currentScore) * (0.55 + 0.45 * (1 - confidenceFactor * 0.4));
  const estimatedHoursToImprove = clamp(
    0.55 + 0.18 * dTopic + 0.12 * dMemory + 0.45 * ((100 - baseScore) / 100),
    0.65,
    2.2
  );
  const priorityROI = clamp(
    Math.round(((incidenceFactor * expectedAccuracyGain) / estimatedHoursToImprove) * 1.45),
    5,
    99
  );

  const level: TopicScoreResult['level'] =
    currentScore >= 75 ? 'strong' : currentScore >= 50 ? 'medium' : 'weak';

  const confidenceLabel =
    effectiveQTotal >= 30 && distinctStudyDays >= 2
      ? 'Alta'
      : effectiveQTotal >= 10
      ? 'Média'
      : 'Baixa (poucas questões)';

  const accText =
    rawAccuracy !== null
      ? `${studyQCorrect}/${studyQTotal} questões certas (${Math.round(rawAccuracy)}%)`
      : 'nenhuma questão feita ainda';

  const explanation = `Nota atual: ${currentScore}/100 (logo após estudar era ${baseScore}/100 • Memória ativa hoje: ${retention}%). Baseado em ${accText} em ${distinctStudyDays} dia(s) de estudo. Próxima revisão ideal em +${nextReviewDays} dias.`;

  const detailedFormulaSteps = [
    `1. Desempenho nas Questões (${Math.round(perfComponent)}/100): Você acertou ${studyQCorrect} de ${studyQTotal} questões (${Math.round(combinedAccuracy)}% considerando histórico recente e simulados).`,
    `2. Nota Logo Após Estudar (${baseScore}/100): Combina seus acertos nas questões (${Math.round(performanceWeight * 100)}%) com o seu nível de segurança declarado (${Math.round(subjectiveWeight * 100)}%) e constância de estudo.`,
    `3. Frescor na Memória Hoje (${retention}%): Sua memória segura bem este assunto por cerca de ${memoryStabilityDays} dias. Como se passaram ${daysSinceLastStudy} dia(s) desde o último estudo, sua nota ajustada hoje é ${currentScore}/100.`,
    `4. Próxima Revisão (+${nextReviewDays} dias -> ${nextReviewDate}): Calculada sob medida para você revisar antes de esquecer, levando em conta a importância deste assunto na prova.`,
  ];

  // DIAGNÓSTICO INTUITIVO (EM LINGUAGEM SIMPLES) DO QUE ESTÁ FAZENDO O SCORE SUBIR OU DESCER
  const impactFactors: ScoreImpactFactor[] = [];

  if (studyQTotal === 0) {
    impactFactors.push({
      type: 'negative',
      label: 'Ainda sem questões feitas neste assunto',
      detail:
        'Sem questões resolvidas, o sistema não tem como ter certeza se você fixou a matéria na prática. Faça pelo menos 10 a 15 questões para sua nota subir!',
    });
  } else if (studyQTotal < 15) {
    impactFactors.push({
      type: 'neutral',
      label: `Poucas questões feitas até agora (${studyQTotal} questões)`,
      detail: `Como você ainda resolveu poucas questões aqui, o sistema calcula a nota com cautela (${Math.round(confidenceFactor * 100)}% de certeza). Quanto mais questões fizer, mais a nota reflete seu nível real.`,
    });
  } else if (rawAccuracy !== null && rawAccuracy >= 80) {
    impactFactors.push({
      type: 'positive',
      label: `Ótimo índice de acertos (${Math.round(rawAccuracy)}% em ${studyQTotal} questões)`,
      detail: 'Você está acertando a grande maioria das questões deste assunto, o que puxa sua nota para cima e dá mais folga até a próxima revisão.',
    });
  } else if (rawAccuracy !== null && rawAccuracy < 60) {
    impactFactors.push({
      type: 'negative',
      label: `Muitos erros nas questões (${Math.round(rawAccuracy)}% de acerto em ${studyQTotal} questões)`,
      detail: 'Você errou bastante neste assunto até aqui. O sistema baixou a nota para chamar uma revisão mais cedo e evitar que você perca pontos na prova.',
    });
  }

  if (lastSessionAccuracy !== null && studyQTotal >= 5) {
    if (lastSessionAccuracy < 55) {
      impactFactors.push({
        type: 'negative',
        label: `Tropeço no último estudo (${Math.round(lastSessionAccuracy)}% de acerto)`,
        detail: 'Como você errou bastante na última vez que estudou este tópico, a próxima revisão foi antecipada para você corrigir logo essas falhas.',
      });
    } else if (lastSessionAccuracy >= 85) {
      impactFactors.push({
        type: 'positive',
        label: `Mandou muito bem no último estudo (${Math.round(lastSessionAccuracy)}% de acerto)`,
        detail: 'Seu ótimo resultado na sessão mais recente mostrou evolução e ajudou a subir sua nota e espaçar a revisão.',
      });
    }
  }

  if (difficulty >= 4 || mastery <= 2) {
    impactFactors.push({
      type: 'negative',
      label: `Assunto que você acha difícil (Dificuldade ${difficulty}/5 • Domínio ${mastery}/5)`,
      detail: 'Como você marcou que sente dificuldade ou pouca segurança aqui, o sistema agenda revisões mais próximas até você pegar firmeza.',
    });
  } else if (mastery >= 4 && difficulty <= 2) {
    impactFactors.push({
      type: 'positive',
      label: `Assunto tranquilo para você (Domínio ${mastery}/5 • Dificuldade ${difficulty}/5)`,
      detail: 'Sua facilidade neste tema faz sua memória segurar o conteúdo por mais dias sem precisar revisar toda hora.',
    });
  }

  if (importance >= 4) {
    impactFactors.push({
      type: 'neutral',
      label: `Cai muito na prova! (Relevância ${importance}/5)`,
      detail: `Por ser um assunto muito cobrado no seu edital, o sistema exige mais segurança (${Math.round(targetRetention * 100)}% de memória mínima) e não deixa você ficar muito tempo sem vê-lo.`,
    });
  }

  if (daysSinceLastStudy >= 7 && retention < 82) {
    impactFactors.push({
      type: 'negative',
      label: `Memória esfriando (${daysSinceLastStudy} dias sem ver este assunto)`,
      detail: `Quando você estudou, sua nota era ${baseScore}/100, mas como já faz ${daysSinceLastStudy} dias sem revisar, sua memória ativa está em ${retention}% e a nota hoje caiu para ${currentScore}/100.`,
    });
  } else if (distinctStudyDays >= 3) {
    impactFactors.push({
      type: 'positive',
      label: `Estudado em ${distinctStudyDays} dias diferentes (Memória dura ~${memoryStabilityDays} dias)`,
      detail: 'Ver o assunto em dias separados fixa muito mais na cabeça e faz sua nota demorar bem mais para cair.',
    });
  }

  // 6. DICA PRÁTICA E INTUITIVA DE COMO REVISAR ESTE TÓPICO
  let scientificReviewTip: ScientificReviewTip;

  if (currentScore < 52 || (lastSessionAccuracy !== null && lastSessionAccuracy < 55)) {
    scientificReviewTip = {
      badge: '🚨 Precisa Reforçar a Base • Teoria Rápida + Questões',
      title: 'Olhar os pontos principais da Teoria (15 min) + 15 Questões Comentadas',
      description:
        'Como você teve dificuldade ou errou bastante recentemente, revise por 15 minutos os pontos principais da teoria ou lei seca e depois resolva 15 questões lendo com atenção o comentário de cada erro.',
      actionType: 'theory_questions',
    };
  } else if (baseScore >= 75 && retention < 78 && hasSavedNotes) {
    scientificReviewTip = {
      badge: '⏱️ Faz Tempo que Não Vê • Ler Seu Resumo + Questões',
      title: 'Ler suas Anotações salvas aqui (5 min) + 15 Questões',
      description: `Você já aprendeu muito bem este assunto (${baseScore}/100), só está há ${daysSinceLastStudy} dias sem vê-lo. Passe o olho por 5 minutos nas suas Notas salvas aqui na plataforma para refrescar a memória e faça 15 questões.`,
      actionType: 'notes_scan_questions',
    };
  } else if (currentScore >= 75 && retention >= 78) {
    scientificReviewTip = {
      badge: '✅ Assunto Dominado • Manutenção Rápida',
      title: 'Ir direto para 10 a 15 Questões Rápidas (Sem reler teoria)',
      description:
        'Você já manda muito bem aqui! Não perca tempo relendo teoria ou PDF. Resolva apenas 10 a 15 questões rápidas direto no caderno só para manter o ritmo de prova.',
      actionType: 'fast_maintenance',
    };
  } else {
    scientificReviewTip = {
      badge: '🎯 Hora de Praticar • Questões Primeiro',
      title: 'Fazer 15 a 20 Questões ANTES de olhar o Resumo',
      description:
        'Tentar lembrar da matéria sozinho resolvendo questões fixa muito mais do que apenas ler! Vá direto para o Caderno de Questões e só consulte suas notas ou a teoria nos itens que você errar.',
      actionType: 'active_recall_questions',
    };
  }

  const statusColor: 'green' | 'yellow' | 'red' =
    currentScore >= 70 ? 'green' : currentScore >= 50 ? 'yellow' : 'red';
  const color: 'emerald' | 'amber' | 'rose' =
    currentScore >= 70 ? 'emerald' : currentScore >= 50 ? 'amber' : 'rose';

  return {
    score: currentScore,
    currentScore,
    baseScore,
    retention,
    urgencyScore,
    priorityROI,
    level,
    color,
    statusColor,
    nextReviewDays,
    reviewIntervalDays: nextReviewDays,
    nextReviewDate,
    daysUntilReview: nextReviewDays - daysSinceLastStudy,
    isDueForReview: daysSinceLastStudy >= nextReviewDays || currentScore < 50,
    forgettingPenalty: Math.max(0, baseScore - currentScore),
    daysSinceLastStudy,
    distinctStudyDays,
    totalQuestions: studyQTotal,
    correctQuestions: studyQCorrect,
    rawAccuracy,
    lastStudyDate: sortedRecords.length > 0 ? formatYMD(lastStudyDate) : (topic?.last_study || null),
    smoothedAccuracy: Math.round(combinedAccuracy),
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
  subject?: EditalSubject | any;
  subjectName?: string;
  topics?: any[];
  studyRecords: StudyRecord[];
  simuladoRecords?: SimuladoRecord[];
  userRetentionMultiplier?: number;
}): SubjectScoreResult {
  const {
    subject,
    studyRecords = [],
    simuladoRecords = [],
    userRetentionMultiplier = 1.0,
  } = params;

  const subjectName = subject?.subject || params.subjectName || '';
  const rawTopics = subject?.topics || params.topics || [];

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

  const leafTopics = flattenLeaves(rawTopics);
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

  const cleanSubjName = (subjectName || '').trim().toLowerCase();
  const subjectRecords = (studyRecords || []).filter(
    (r) => (r.subject || '').trim().toLowerCase() === cleanSubjName
  );
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
      if ((sSub.subjectName || '').trim().toLowerCase() === cleanSubjName) {
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
  let avgTopicRetention = weightTotal > 0 ? weightedRetentionSum / weightTotal : 0;

  // Fallback inteligente: se houver histórico de estudos na disciplina mas os tópicos avaliados foram 0
  if (topicsEvaluated === 0 && subjectRecords.length > 0) {
    const totalTimeHours =
      subjectRecords.reduce((acc, r) => acc + (r.studyTime || 0), 0) / (1000 * 60 * 60);
    const acc = studyQTotal > 0 ? (studyQCorrect / studyQTotal) * 100 : 60;
    const hoursEffort = Math.min(1, Math.sqrt(totalTimeHours / 3.5)) * 30;
    const qEffort = Math.min(1, Math.sqrt(studyQTotal / 35)) * 30;
    avgTopicScore = clamp(acc * 0.4 + hoursEffort + qEffort, 25, 88);
    avgTopicRetention = Math.round(
      clamp(Math.pow(1 + (19 / 81) * (daysSinceLastStudy / 12), -0.5) * 100, 20, 95)
    );
  }

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
    combinedAccuracyPct: combinedAccuracy ?? 0,
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

export interface UserMemoryProfile {
  personalRetentionFactor: number;
  summaryText: string;
}

export function computeUserMemoryProfile(
  studyRecords: StudyRecord[],
  simuladoRecords?: SimuladoRecord[]
): UserMemoryProfile {
  const factor = Number(computeUserRetentionMultiplier(studyRecords).toFixed(2));
  let summaryText = '';
  if (factor >= 1.15) {
    summaryText = `Você tem lembrado muito bem das matérias nas revisões (+${Math.round(
      (factor - 1) * 100
    )}% acima da média)! Por isso, o sistema está dando mais dias de folga entre uma revisão e outra para você avançar mais rápido no edital.`;
  } else if (factor <= 0.88) {
    summaryText = `O sistema notou que nas últimas revisões alguns conteúdos esfriaram rápido (-${Math.round(
      (1 - factor) * 100
    )}%). Por segurança, ele está chamando suas próximas revisões um pouco mais cedo para você não esquecer nada.`;
  } else {
    summaryText = `Seu ritmo de memória está super equilibrado (${factor}x). Conforme você for fazendo mais questões e revisões, o sistema vai ajustando automaticamente esse tempo para o seu jeito de aprender.`;
  }
  return { personalRetentionFactor: factor, summaryText };
}

export function calculateSmartSessionReview(params: {
  sessionCorrect: number;
  sessionIncorrect: number;
  previousSessionsCount?: number;
  relevance?: number;
  difficulty?: number;
  perceivedMastery?: number;
  topicRecords?: StudyRecord[];
  subjectRecords?: StudyRecord[];
  allStudyRecords?: StudyRecord[];
  simuladoRecords?: SimuladoRecord[];
  subjectName?: string;
  topicName?: string;
}): SmartSessionReviewEstimate {
  const {
    sessionCorrect = 0,
    sessionIncorrect = 0,
    relevance = 3,
    difficulty = 3,
    perceivedMastery = 3,
    topicRecords = [],
    allStudyRecords = [],
    simuladoRecords = [],
    subjectName = '',
    topicName = 'Tópico Atual',
  } = params;

  const simulatedRecord: StudyRecord = {
    id: 'simulated-session',
    date: formatYMD(new Date()),
    subjectId: '',
    subject: subjectName,
    topic: topicName,
    studyTime: 45 * 60 * 1000,
    questions: {
      correct: sessionCorrect,
      total: sessionCorrect + sessionIncorrect,
    },
    pages: [],
    videos: [],
    notes: '',
    category: sessionCorrect + sessionIncorrect > 0 ? 'questoes' : 'teoria',
    teoriaFinalizada: false,
    countInPlanning: true,
  };

  const combinedRecords = [...topicRecords, simulatedRecord];
  const userMult = computeUserRetentionMultiplier(allStudyRecords);

  // Executa computeTopicScore com o array de registros já consolidados
  const res = computeTopicScore(
    combinedRecords,
    relevance,
    difficulty,
    perceivedMastery,
    {
      subjectName,
      topicText: topicName,
      simuladoRecords,
      userRetentionMultiplier: userMult,
      isCompleted: true,
    }
  );

  const qTotal = sessionCorrect + sessionIncorrect;
  const days = Math.max(1, res.nextReviewDays);
  let tierLabel = 'Bom Ritmo';
  let tierColor: 'rose' | 'amber' | 'emerald' | 'indigo' = 'emerald';
  let reason = '';
  let sessionAccuracyPct: number | null = null;

  if (qTotal === 0) {
    tierLabel = 'Só Teoria';
    tierColor = 'indigo';
    reason = `Como você estudou a teoria sem registrar questões hoje, agendamos a revisão para daqui a ${days} dias para você praticar antes de esquecer.`;
  } else {
    sessionAccuracyPct = Math.round((sessionCorrect / qTotal) * 100);
    if (sessionAccuracyPct >= 80) {
      tierLabel = 'Ótimo Acerto';
      tierColor = 'emerald';
      reason = `Você mandou muito bem com ${sessionAccuracyPct}% de acerto (${sessionCorrect}/${qTotal})! Sua memória ganhou força e a próxima revisão ficou para daqui a +${days} dias.`;
    } else if (sessionAccuracyPct >= 65) {
      tierLabel = 'Bom Resultado';
      tierColor = 'emerald';
      reason = `Bom resultado de ${sessionAccuracyPct}% (${sessionCorrect}/${qTotal} acertos). Próxima revisão agendada para daqui a +${days} dias para fixar bem o assunto.`;
    } else if (sessionAccuracyPct >= 50) {
      tierLabel = 'Pede Reforço';
      tierColor = 'amber';
      reason = `Você acertou ${sessionAccuracyPct}% (${sessionCorrect}/${qTotal}). Para não esquecer os detalhes, vamos revisar mais cedo, daqui a +${days} dias.`;
    } else {
      tierLabel = 'Revisar Cedo';
      tierColor = 'rose';
      reason = `Você acertou ${sessionAccuracyPct}% (${sessionCorrect}/${qTotal}). Como houve bastante erro hoje, antecipamos a revisão para daqui a +${days} dias para você corrigir logo os pontos fracos.`;
    }
  }

  return {
    days,
    tierLabel,
    tierColor,
    reason,
    sessionAccuracyPct,
    baseScore: res.baseScore,
    finalScore: res.score,
    explanation: res.explanation,
  };
}
