import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase';
import type {
  PlanData,
  ReviewRecord,
  SimuladoRecord,
  StudyCycleData,
  StudyRecord,
} from '@/app/actions';

export function normalizePlanFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (trimmed.endsWith('.cycle.json')) {
    return trimmed.replace(/\.cycle\.json$/, '.json');
  }
  return trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`;
}

export function mapRowToStudyRecord(row: any): StudyRecord {
  return {
    id: row.id,
    date: row.date,
    subjectId: row.subject_id,
    subject: row.subject,
    topic: row.topic,
    studyTime: row.study_time,
    questions: row.questions || { correct: 0, total: 0 },
    pages: row.pages || [],
    videos: row.videos || [],
    notes: row.notes || '',
    category: row.category || '',
    reviewPeriods: row.review_periods ?? undefined,
    teoriaFinalizada: Boolean(row.teoria_finalizada),
    countInPlanning: row.count_in_planning ?? true,
  };
}

export function mapStudyRecordToRow(planId: string, userId: string, record: StudyRecord) {
  return {
    id: record.id || crypto.randomUUID(),
    plan_id: planId,
    user_id: userId,
    date: record.date,
    subject_id: record.subjectId || '',
    subject: record.subject || '',
    topic: record.topic || '',
    study_time: record.studyTime || 0,
    questions: record.questions || { correct: 0, total: 0 },
    pages: record.pages || [],
    videos: record.videos || [],
    notes: record.notes || '',
    category: record.category || '',
    review_periods: record.reviewPeriods ?? null,
    teoria_finalizada: Boolean(record.teoriaFinalizada),
    count_in_planning: record.countInPlanning ?? true,
  };
}

export function mapRowToReviewRecord(row: any): ReviewRecord {
  return {
    id: row.id,
    studyRecordId: row.study_record_id,
    scheduledDate: row.scheduled_date,
    status: row.status,
    originalDate: row.original_date,
    subjectId: row.subject_id,
    subject: row.subject,
    topic: row.topic,
    reviewPeriod: row.review_period,
    completedDate: row.completed_date ?? undefined,
    ignored: Boolean(row.ignored),
  };
}

export function mapReviewRecordToRow(planId: string, userId: string, record: ReviewRecord) {
  return {
    id: record.id || crypto.randomUUID(),
    plan_id: planId,
    user_id: userId,
    study_record_id: record.studyRecordId,
    scheduled_date: record.scheduledDate,
    status: record.status,
    original_date: record.originalDate,
    subject_id: record.subjectId || '',
    subject: record.subject || '',
    topic: record.topic || '',
    review_period: record.reviewPeriod || '',
    completed_date: record.completedDate ?? null,
    ignored: Boolean(record.ignored),
  };
}

export function mapRowToSimuladoRecord(row: any): SimuladoRecord {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    style: row.style,
    banca: row.banca,
    timeSpent: row.time_spent,
    subjects: row.subjects || [],
    comments: row.comments || '',
  };
}

export function mapSimuladoRecordToRow(planId: string, userId: string, record: SimuladoRecord) {
  return {
    id: record.id || crypto.randomUUID(),
    plan_id: planId,
    user_id: userId,
    date: record.date,
    name: record.name,
    style: record.style || '',
    banca: record.banca || '',
    time_spent: record.timeSpent || '',
    subjects: record.subjects || [],
    comments: record.comments || '',
  };
}

export function mapRowToCycleData(row: any): StudyCycleData {
  return {
    studyCycle: row.study_cycle ?? null,
    studyHours: row.study_hours || '',
    weeklyQuestionsGoal: row.weekly_questions_goal || '',
    currentProgressMinutes: row.current_progress_minutes || 0,
    sessionProgressMap: row.session_progress_map || {},
    reminderNotes: row.reminder_notes || [],
    studyDays: row.study_days || [],
  };
}

export async function getPlanMeta(userId: string, fileName: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizePlanFileName(fileName);

  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('file_name', normalized)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao buscar plano ${normalized}:`, error);
    throw error;
  }

  return data;
}

export async function ensurePlanMeta(userId: string, fileName: string) {
  const existing = await getPlanMeta(userId, fileName);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  const normalized = normalizePlanFileName(fileName);
  const { data, error } = await supabase
    .from('study_plans')
    .insert({
      user_id: userId,
      file_name: normalized,
      name: '',
      observations: '',
      subjects: [],
      banca_topic_weights: {},
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error(`Erro ao inicializar plano ${normalized}:`, error);
    throw error || new Error('Falha ao criar plano.');
  }

  return data;
}

export async function getFullPlanData(userId: string, fileName: string): Promise<PlanData | null> {
  const plan = await getPlanMeta(userId, fileName);
  if (!plan) return null;

  const supabase = getSupabaseAdmin();
  const [recordsRes, reviewsRes, simuladosRes] = await Promise.all([
    supabase
      .from('study_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id),
    supabase
      .from('review_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id),
    supabase
      .from('simulado_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id),
  ]);

  if (recordsRes.error) throw recordsRes.error;
  if (reviewsRes.error) throw reviewsRes.error;
  if (simuladosRes.error) throw simuladosRes.error;

  return {
    name: plan.name,
    observations: plan.observations || '',
    cargo: plan.cargo || '',
    edital: plan.edital || '',
    iconUrl: plan.icon_url ?? undefined,
    subjects: plan.subjects || [],
    bancaTopicWeights: plan.banca_topic_weights || {},
    records: (recordsRes.data || []).map(mapRowToStudyRecord),
    reviewRecords: (reviewsRes.data || []).map(mapRowToReviewRecord),
    simuladoRecords: (simuladosRes.data || []).map(mapRowToSimuladoRecord),
  };
}

export async function upsertFullPlanData(userId: string, fileName: string, planData: PlanData): Promise<string> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizePlanFileName(fileName);

  const { data: plan, error: planError } = await supabase
    .from('study_plans')
    .upsert(
      {
        user_id: userId,
        file_name: normalized,
        name: planData.name || '',
        observations: planData.observations || '',
        cargo: planData.cargo || '',
        edital: planData.edital || '',
        icon_url: planData.iconUrl ?? null,
        subjects: planData.subjects || [],
        banca_topic_weights: planData.bancaTopicWeights || {},
      },
      { onConflict: 'user_id,file_name' }
    )
    .select('id')
    .single();

  if (planError || !plan) {
    throw planError || new Error('Falha ao salvar plano no Supabase.');
  }

  const upsertInBatches = async (table: string, rows: any[]) => {
    const deduped = Array.from(
      rows.reduce((map, row) => map.set(row.id, row), new Map<string, any>()).values()
    );
    const BATCH_SIZE = 500;
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const chunk = deduped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'plan_id,id' });
      if (error) throw error;
    }
  };

  if (planData.records && planData.records.length > 0) {
    const rows = planData.records.map((r) => mapStudyRecordToRow(plan.id, userId, r));
    await upsertInBatches('study_records', rows);
  }

  if (planData.reviewRecords && planData.reviewRecords.length > 0) {
    const rows = planData.reviewRecords.map((r) => mapReviewRecordToRow(plan.id, userId, r));
    await upsertInBatches('review_records', rows);
  }

  if (planData.simuladoRecords && planData.simuladoRecords.length > 0) {
    const rows = planData.simuladoRecords.map((r) => mapSimuladoRecordToRow(plan.id, userId, r));
    await upsertInBatches('simulado_records', rows);
  }

  return plan.id;
}
