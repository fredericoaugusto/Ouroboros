'use server';

import crypto from 'crypto';
import { EditalTopic, EditalSubject as Subject } from '@/context/DataContext';
import { getSupabaseAdmin } from '@/lib/supabase';
import { EffectiveStudentSession, getEffectiveStudentSession } from '@/lib/adminAuth';
import { recordStudentAudit } from '@/lib/auditLogger';
import {
  ensurePlanMeta,
  getFullPlanData,
  getPlanMeta,
  mapReviewRecordToRow,
  mapRowToCycleData,
  mapRowToReviewRecord,
  mapRowToSimuladoRecord,
  mapRowToStudyRecord,
  mapSimuladoRecordToRow,
  mapStudyRecordToRow,
  normalizePlanFileName,
  upsertFullPlanData,
} from '@/lib/studyPlansRepo';

export interface StudyRecord {
  id: string;
  date: string;
  subjectId: string;
  subject: string;
  topic: string;
  studyTime: number;
  questions: { correct: number; total: number };
  pages: { start: number; end: number }[];
  videos: { title: string; start: string; end: string }[];
  notes: string;
  category: string;
  reviewPeriods?: string[];
  teoriaFinalizada: boolean;
  countInPlanning: boolean;
}

export interface ReviewRecord {
  id: string;
  studyRecordId: string;
  scheduledDate: string;
  status: 'pending' | 'completed' | 'skipped';
  originalDate: string;
  subjectId: string;
  subject: string;
  topic: string;
  reviewPeriod: string;
  completedDate?: string;
  ignored?: boolean;
}

export interface SimuladoSubject {
  id: string;
  subjectName: string;
  weight: number;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  color: string;
}

export interface SimuladoRecord {
  id: string;
  date: string;
  name: string;
  style: string;
  banca: string;
  timeSpent: string;
  subjects: SimuladoSubject[];
  comments: string;
}

export interface PlanData {
  name: string;
  observations: string;
  cargo?: string;
  edital?: string;
  iconUrl?: string;
  subjects: Subject[];
  bancaTopicWeights?: {
    [subjectId: string]: {
      [topicText: string]: number;
    };
  };
  records?: StudyRecord[];
  reviewRecords?: ReviewRecord[];
  simuladoRecords?: SimuladoRecord[];
}

export interface StudyCycleData {
  studyCycle: any[] | null;
  studyHours: string;
  weeklyQuestionsGoal: string;
  currentProgressMinutes: number;
  sessionProgressMap: { [key: string]: number };
  reminderNotes: any[];
  studyDays: string[];
}

async function requireStudentSession(): Promise<EffectiveStudentSession> {
  const session = await getEffectiveStudentSession();
  if (!session || !session.userId) {
    throw new Error('Usuário não autenticado.');
  }
  return session;
}

async function getAuthenticatedUserId(): Promise<string> {
  const session = await requireStudentSession();
  return session.userId;
}

export async function saveStudyCycleToFile(
  planFileName: string,
  cycleData: StudyCycleData
): Promise<{ success: boolean; error?: string }> {
  if (!planFileName) {
    return { success: false, error: 'Nome do arquivo do plano não fornecido.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const supabase = getSupabaseAdmin();
    const normalizedPlan = normalizePlanFileName(planFileName);

    const { error } = await supabase.from('study_cycles').upsert(
      {
        user_id: userId,
        plan_file_name: normalizedPlan,
        study_cycle: cycleData.studyCycle,
        study_hours: cycleData.studyHours || '',
        weekly_questions_goal: cycleData.weeklyQuestionsGoal || '',
        current_progress_minutes: cycleData.currentProgressMinutes || 0,
        session_progress_map: cycleData.sessionProgressMap || {},
        reminder_notes: cycleData.reminderNotes || [],
        study_days: cycleData.studyDays || [],
      },
      { onConflict: 'user_id,plan_file_name' }
    );

    if (error) throw error;
    await recordStudentAudit(session, 'CYCLE_SAVE', 'cycle', normalizedPlan, {
      sessionsCount: cycleData.studyCycle?.length ?? 0,
      studyHours: cycleData.studyHours,
    });
    return { success: true };
  } catch (error) {
    console.error(`Erro ao salvar o ciclo ${planFileName}:`, error);
    return { success: false, error: 'Falha ao salvar o ciclo de estudos.' };
  }
}

export async function getStudyCycleFromFile(planFileName: string): Promise<StudyCycleData | null> {
  if (!planFileName) return null;

  try {
    const userId = await getAuthenticatedUserId();
    const supabase = getSupabaseAdmin();
    const normalizedPlan = normalizePlanFileName(planFileName);

    const { data, error } = await supabase
      .from('study_cycles')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_file_name', normalizedPlan)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapRowToCycleData(data);
  } catch (error) {
    console.error(`Erro ao ler o ciclo ${planFileName}:`, error);
    return null;
  }
}

export async function deleteStudyCycleFile(planFileName: string): Promise<{ success: boolean; error?: string }> {
  if (!planFileName) {
    return { success: false, error: 'Nome do arquivo do plano não fornecido.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const supabase = getSupabaseAdmin();
    const normalizedPlan = normalizePlanFileName(planFileName);

    const { error } = await supabase
      .from('study_cycles')
      .delete()
      .eq('user_id', userId)
      .eq('plan_file_name', normalizedPlan);

    if (error) throw error;
    await recordStudentAudit(session, 'CYCLE_DELETE', 'cycle', normalizedPlan);
    return { success: true };
  } catch (error) {
    console.error(`Erro ao deletar o ciclo ${planFileName}:`, error);
    return { success: false, error: 'Falha ao deletar o arquivo do ciclo.' };
  }
}

export async function getJsonFiles(): Promise<string[]> {
  try {
    const userId = await getAuthenticatedUserId();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('study_plans')
      .select('file_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => row.file_name);
  } catch (error) {
    console.error('Failed to read plans from Supabase:', error);
    return [];
  }
}

export async function deleteJsonFile(fileName: string): Promise<void> {
  const session = await requireStudentSession();
  const userId = session.userId;
  const supabase = getSupabaseAdmin();
  const normalized = normalizePlanFileName(fileName);

  const { error } = await supabase
    .from('study_plans')
    .delete()
    .eq('user_id', userId)
    .eq('file_name', normalized);

  if (error) {
    console.error(`Error deleting plan ${fileName}:`, error);
    throw new Error(`Failed to delete plan: ${fileName}`);
  }

  await supabase
    .from('study_cycles')
    .delete()
    .eq('user_id', userId)
    .eq('plan_file_name', normalized);

  await recordStudentAudit(session, 'PLAN_DELETE', 'plan', normalized);
}

export async function getJsonContent(fileName: string) {
  if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
    console.error('getJsonContent called with invalid fileName:', fileName);
    return null;
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (fileName.endsWith('.cycle.json')) {
      return await getStudyCycleFromFile(fileName);
    }
    return await getFullPlanData(userId, fileName);
  } catch (error) {
    console.error(`Error reading ${fileName}:`, error);
    return null;
  }
}

export async function saveStudyRecord(fileName: string, record: StudyRecord): Promise<void> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await ensurePlanMeta(userId, fileName);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('study_records')
      .upsert(mapStudyRecordToRow(plan.id, userId, record), { onConflict: 'plan_id,id' });

    if (error) throw error;
    await recordStudentAudit(session, 'STUDY_RECORD_SAVE', 'study_record', record.id, {
      fileName,
      subject: record.subject,
      topic: record.topic,
      studyTime: record.studyTime,
    });
  } catch (error) {
    console.error('Error saving study record:', error);
    throw error;
  }
}

export async function getStudyRecords(fileName: string): Promise<StudyRecord[]> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('study_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id);

    if (error) throw error;
    return (data || []).map(mapRowToStudyRecord);
  } catch (error) {
    console.error('Error reading study records:', error);
    return [];
  }
}

export async function saveReviewRecord(fileName: string, record: ReviewRecord): Promise<void> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await ensurePlanMeta(userId, fileName);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('review_records')
      .upsert(mapReviewRecordToRow(plan.id, userId, record), { onConflict: 'plan_id,id' });

    if (error) throw error;
    await recordStudentAudit(session, 'REVIEW_RECORD_SAVE', 'review_record', record.id, {
      fileName,
      status: record.status,
      subject: record.subject,
      topic: record.topic,
    });
  } catch (error) {
    console.error('Error saving review record:', error);
    throw error;
  }
}

export async function getReviewRecords(fileName: string): Promise<ReviewRecord[]> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('review_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id);

    if (error) throw error;
    return (data || []).map(mapRowToReviewRecord);
  } catch (error) {
    console.error('Error reading review records:', error);
    return [];
  }
}

export async function saveSimuladoRecord(fileName: string, record: SimuladoRecord): Promise<void> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await ensurePlanMeta(userId, fileName);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('simulado_records')
      .upsert(mapSimuladoRecordToRow(plan.id, userId, record), { onConflict: 'plan_id,id' });

    if (error) throw error;
    await recordStudentAudit(session, 'SIMULADO_RECORD_SAVE', 'simulado_record', record.id, {
      fileName,
      name: record.name,
      banca: record.banca,
    });
  } catch (error) {
    console.error('Error saving simulado record:', error);
    throw error;
  }
}

export async function getSimuladoRecords(fileName: string): Promise<SimuladoRecord[]> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('simulado_records')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', plan.id);

    if (error) throw error;
    return (data || []).map(mapRowToSimuladoRecord);
  } catch (error) {
    console.error('Error reading simulado records:', error);
    return [];
  }
}

export async function migrateStudyRecordIds(fileName: string) {
  try {
    await getAuthenticatedUserId();
    // Registros no Supabase já exigem id como parte da chave primária.
    return { success: true, migrated: false };
  } catch (error) {
    console.error(`Error migrating IDs for ${fileName}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteStudyRecordAction(fileName: string, recordId: string): Promise<void> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) return;

    const supabase = getSupabaseAdmin();
    await supabase
      .from('review_records')
      .delete()
      .eq('user_id', userId)
      .eq('plan_id', plan.id)
      .eq('study_record_id', recordId);

    const { error } = await supabase
      .from('study_records')
      .delete()
      .eq('user_id', userId)
      .eq('plan_id', plan.id)
      .eq('id', recordId);

    if (error) throw error;
    await recordStudentAudit(session, 'STUDY_RECORD_DELETE', 'study_record', recordId, { fileName });
  } catch (error) {
    console.error('Error deleting study record:', error);
    throw error;
  }
}

export async function createPlanFile(
  formData: FormData
): Promise<{ success: boolean; fileName?: string; error?: string }> {
  const planName = formData.get('name') as string;
  const observations = (formData.get('observations') as string) || '';
  const cargo = (formData.get('cargo') as string) || '';
  const edital = (formData.get('edital') as string) || '';
  const imageFile = formData.get('image') as File;

  if (!planName || planName.trim() === '') {
    return { success: false, error: 'O nome do plano não pode estar vazio.' };
  }

  const sanitizedPlanName = planName.trim().toLowerCase().replace(/\s+/g, '-');
  const jsonFileName = `${sanitizedPlanName}.json`;

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const existing = await getPlanMeta(userId, jsonFileName);
    if (existing) {
      return { success: false, error: `O plano '${planName}' já existe.` };
    }

    let iconUrl: string | undefined = undefined;
    if (imageFile && imageFile.size > 0) {
      try {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        iconUrl = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
      } catch (error) {
        console.error('Erro ao converter imagem para Base64:', error);
        return { success: false, error: 'Falha ao processar a imagem do plano.' };
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('study_plans').insert({
      user_id: userId,
      file_name: jsonFileName,
      name: planName.trim(),
      observations: observations.trim(),
      cargo: cargo.trim(),
      edital: edital.trim(),
      icon_url: iconUrl ?? null,
      subjects: [],
      banca_topic_weights: {},
    });

    if (error) throw error;
    await recordStudentAudit(session, 'PLAN_CREATE', 'plan', jsonFileName, {
      name: planName.trim(),
      cargo: cargo.trim(),
      edital: edital.trim(),
    });
    return { success: true, fileName: jsonFileName };
  } catch (error) {
    console.error(`Erro ao criar o plano ${jsonFileName}:`, error);
    return { success: false, error: 'Falha ao criar o arquivo do plano.' };
  }
}

export async function updatePlanFile(
  fileName: string,
  updatedData: Partial<PlanData>
): Promise<{ success: boolean; error?: string }> {
  if (!fileName || fileName.trim() === '') {
    return { success: false, error: 'File name cannot be empty.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plan not found.' };
    }

    const supabase = getSupabaseAdmin();
    const patch: Record<string, any> = {};

    if (updatedData.name !== undefined) patch.name = updatedData.name;
    if (updatedData.observations !== undefined) patch.observations = updatedData.observations;
    if (updatedData.cargo !== undefined) patch.cargo = updatedData.cargo;
    if (updatedData.edital !== undefined) patch.edital = updatedData.edital;
    if (updatedData.iconUrl !== undefined) patch.icon_url = updatedData.iconUrl;
    if (updatedData.subjects !== undefined) patch.subjects = updatedData.subjects;
    if (updatedData.bancaTopicWeights !== undefined) {
      patch.banca_topic_weights = updatedData.bancaTopicWeights;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('study_plans')
        .update(patch)
        .eq('id', plan.id)
        .eq('user_id', userId);

      if (error) throw error;
    }

    if (updatedData.records !== undefined) {
      await supabase
        .from('study_records')
        .delete()
        .eq('plan_id', plan.id)
        .eq('user_id', userId);
      if (updatedData.records.length > 0) {
        const rows = updatedData.records.map((r) => mapStudyRecordToRow(plan.id, userId, r));
        const { error } = await supabase.from('study_records').insert(rows);
        if (error) throw error;
      }
    }

    if (updatedData.reviewRecords !== undefined) {
      await supabase
        .from('review_records')
        .delete()
        .eq('plan_id', plan.id)
        .eq('user_id', userId);
      if (updatedData.reviewRecords.length > 0) {
        const rows = updatedData.reviewRecords.map((r) => mapReviewRecordToRow(plan.id, userId, r));
        const { error } = await supabase.from('review_records').insert(rows);
        if (error) throw error;
      }
    }

    if (updatedData.simuladoRecords !== undefined) {
      await supabase
        .from('simulado_records')
        .delete()
        .eq('plan_id', plan.id)
        .eq('user_id', userId);
      if (updatedData.simuladoRecords.length > 0) {
        const rows = updatedData.simuladoRecords.map((r) =>
          mapSimuladoRecordToRow(plan.id, userId, r)
        );
        const { error } = await supabase.from('simulado_records').insert(rows);
        if (error) throw error;
      }
    }

    await recordStudentAudit(session, 'PLAN_UPDATE', 'plan', fileName, {
      updatedFields: Object.keys(updatedData),
    });

    return { success: true };
  } catch (error) {
    console.error(`Error updating plan ${fileName}:`, error);
    return { success: false, error: 'Failed to update the plan file.' };
  }
}

export async function deletePlanFile(fileName: string): Promise<{ success: boolean; error?: string }> {
  if (!fileName || fileName.trim() === '') {
    return { success: false, error: 'File name cannot be empty.' };
  }

  try {
    await deleteJsonFile(fileName);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting plan ${fileName}:`, error);
    return { success: false, error: 'Failed to delete the plan file.' };
  }
}

export async function uploadImage(
  formData: FormData
): Promise<{ success: boolean; iconUrl?: string; error?: string }> {
  const imageFile = formData.get('imageFile') as File;
  if (!imageFile || imageFile.size === 0) return { success: false, error: 'No image file provided.' };
  try {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const iconUrl = `data:${imageFile.type};base64,${buffer.toString('base64')}`;
    return { success: true, iconUrl };
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    return { success: false, error: 'Failed to process the image.' };
  }
}

export async function updateSimuladoRecord(fileName: string, record: SimuladoRecord): Promise<void> {
  await saveSimuladoRecord(fileName, record);
}

export async function deleteSimuladoRecordAction(fileName: string, recordId: string): Promise<void> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) return;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('simulado_records')
      .delete()
      .eq('user_id', userId)
      .eq('plan_id', plan.id)
      .eq('id', recordId);

    if (error) throw error;
    await recordStudentAudit(session, 'SIMULADO_RECORD_DELETE', 'simulado_record', recordId, {
      fileName,
    });
  } catch (error) {
    console.error('Error deleting simulado record:', error);
    throw error;
  }
}

export async function exportFullBackupAction(): Promise<any> {
  const session = await requireStudentSession();
  const userId = session.userId;
  const supabase = getSupabaseAdmin();

  const [plansRes, cyclesRes] = await Promise.all([
    supabase.from('study_plans').select('file_name').eq('user_id', userId),
    supabase.from('study_cycles').select('*').eq('user_id', userId),
  ]);

  if (plansRes.error) throw plansRes.error;
  if (cyclesRes.error) throw cyclesRes.error;

  const allPlansData = [];
  for (const row of plansRes.data || []) {
    const planContent = await getFullPlanData(userId, row.file_name);
    if (planContent) {
      allPlansData.push({ fileName: row.file_name, content: planContent });
    }
  }

  const allCyclesData = (cyclesRes.data || []).map((row) => ({
    fileName: row.plan_file_name.replace(/\.json$/, '.cycle.json'),
    content: mapRowToCycleData(row),
  }));

  await recordStudentAudit(session, 'BACKUP_EXPORT', 'backup', userId, {
    plansCount: allPlansData.length,
    cyclesCount: allCyclesData.length,
  });

  return { plans: allPlansData, cycles: allCyclesData };
}

export async function restoreFullBackupAction(backupData: {
  plans: { fileName: string; content: any }[];
  cycles?: { fileName: string; content: any }[];
  clientData?: {
    selectedDataFile?: string;
    studyCycle?: any[] | null;
    studyHours?: string;
    weeklyQuestionsGoal?: string;
    currentProgressMinutes?: number;
    sessionProgressMap?: { [key: string]: number };
    reminderNotes?: any[];
    studyDays?: string[];
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;

    if (!backupData.plans || !Array.isArray(backupData.plans)) {
      throw new Error("O backup está faltando a lista de 'planos' ou ela é inválida.");
    }

    await clearAllDataAction();

    for (const plan of backupData.plans) {
      if (plan?.fileName && plan?.content) {
        await upsertFullPlanData(userId, plan.fileName, plan.content);
      }
    }

    if (backupData.cycles && Array.isArray(backupData.cycles) && backupData.cycles.length > 0) {
      for (const cycle of backupData.cycles) {
        if (cycle?.fileName && cycle?.content) {
          await saveStudyCycleToFile(cycle.fileName, cycle.content);
        }
      }
    } else if (backupData.clientData?.selectedDataFile && backupData.clientData?.studyCycle) {
      await saveStudyCycleToFile(backupData.clientData.selectedDataFile, {
        studyCycle: backupData.clientData.studyCycle,
        studyHours: backupData.clientData.studyHours || '',
        weeklyQuestionsGoal: backupData.clientData.weeklyQuestionsGoal || '',
        currentProgressMinutes: backupData.clientData.currentProgressMinutes || 0,
        sessionProgressMap: backupData.clientData.sessionProgressMap || {},
        reminderNotes: backupData.clientData.reminderNotes || [],
        studyDays: backupData.clientData.studyDays || [],
      });
    }

    await recordStudentAudit(session, 'BACKUP_RESTORE', 'backup', userId, {
      plansRestored: backupData.plans.length,
      cyclesRestored: backupData.cycles?.length ?? 0,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro durante a restauração do backup:', error);
    return { success: false, error: error.message || 'Falha ao restaurar o backup.' };
  }
}

export async function clearAllDataAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const supabase = getSupabaseAdmin();

    const [plansDel, cyclesDel] = await Promise.all([
      supabase.from('study_plans').delete().eq('user_id', userId),
      supabase.from('study_cycles').delete().eq('user_id', userId),
    ]);

    if (plansDel.error) throw plansDel.error;
    if (cyclesDel.error) throw cyclesDel.error;

    await recordStudentAudit(session, 'DATA_CLEAR_ALL', 'user', userId);

    return { success: true };
  } catch (error: any) {
    console.error('Error clearing all data:', error);
    return { success: false, error: error.message || 'Failed to clear all data.' };
  }
}

export async function exportAllDataAction(): Promise<any> {
  const userId = await getAuthenticatedUserId();
  const planFiles = await getJsonFiles();
  const allPlansData = [];

  for (const fileName of planFiles) {
    const planContent = await getFullPlanData(userId, fileName);
    if (planContent) {
      allPlansData.push({ fileName, content: planContent });
    }
  }

  return { plans: allPlansData };
}

export async function renameSubjectAction(
  fileName: string,
  subjectId: string,
  newSubjectName: string
): Promise<{ success: boolean; error?: string; oldSubjectName?: string }> {
  if (!fileName || !subjectId || !newSubjectName) {
    return { success: false, error: 'Parâmetros inválidos para renomear matéria.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plano não encontrado.' };
    }

    const supabase = getSupabaseAdmin();
    let oldSubjectName = '';
    const updatedSubjects = (plan.subjects || []).map((s: Subject) => {
      if (s.id === subjectId) {
        oldSubjectName = s.subject;
        return { ...s, subject: newSubjectName };
      }
      return s;
    });

    const { error: planErr } = await supabase
      .from('study_plans')
      .update({ subjects: updatedSubjects })
      .eq('id', plan.id)
      .eq('user_id', userId);
    if (planErr) throw planErr;

    await Promise.all([
      supabase
        .from('study_records')
        .update({ subject: newSubjectName })
        .eq('plan_id', plan.id)
        .eq('user_id', userId)
        .eq('subject_id', subjectId),
      supabase
        .from('review_records')
        .update({ subject: newSubjectName })
        .eq('plan_id', plan.id)
        .eq('user_id', userId)
        .eq('subject_id', subjectId),
    ]);

    const { data: simulados } = await supabase
      .from('simulado_records')
      .select('id, subjects')
      .eq('plan_id', plan.id)
      .eq('user_id', userId);

    if (simulados && simulados.length > 0) {
      for (const sim of simulados) {
        const updatedSimSubjects = (sim.subjects || []).map((ss: SimuladoSubject) =>
          ss.id === subjectId ? { ...ss, subjectName: newSubjectName } : ss
        );
        await supabase
          .from('simulado_records')
          .update({ subjects: updatedSimSubjects })
          .eq('plan_id', plan.id)
          .eq('user_id', userId)
          .eq('id', sim.id);
      }
    }

    const normalizedPlan = normalizePlanFileName(fileName);
    const { data: cycleRow } = await supabase
      .from('study_cycles')
      .select('id, study_cycle')
      .eq('user_id', userId)
      .eq('plan_file_name', normalizedPlan)
      .maybeSingle();

    if (cycleRow && Array.isArray(cycleRow.study_cycle)) {
      const updatedCycle = cycleRow.study_cycle.map((session: any) =>
        session.subjectId === subjectId ? { ...session, subject: newSubjectName } : session
      );
      await supabase
        .from('study_cycles')
        .update({ study_cycle: updatedCycle })
        .eq('id', cycleRow.id)
        .eq('user_id', userId);
    }

    await recordStudentAudit(session, 'SUBJECT_RENAME', 'subject', subjectId, {
      fileName,
      oldSubjectName,
      newSubjectName,
    });

    return { success: true, oldSubjectName };
  } catch (error: any) {
    console.error(
      `Erro ao renomear a matéria com ID '${subjectId}' para '${newSubjectName}' em ${fileName}:`,
      error
    );
    return { success: false, error: error.message || 'Falha ao renomear a matéria.' };
  }
}

export async function addOrUpdateSubjectAction(
  fileName: string,
  subjectData: { id?: string; subject: string; topics: EditalTopic[]; color: string }
): Promise<{ success: boolean; error?: string; subjectId?: string }> {
  if (!fileName || !subjectData || !subjectData.subject) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plano não encontrado.' };
    }

    const subjects: Subject[] = Array.isArray(plan.subjects) ? [...plan.subjects] : [];
    const existingSubjectIndex = subjectData.id
      ? subjects.findIndex((s) => s.id === subjectData.id)
      : -1;

    let resultSubjectId: string;
    if (existingSubjectIndex !== -1) {
      subjects[existingSubjectIndex] = {
        ...subjects[existingSubjectIndex],
        ...subjectData,
      };
      resultSubjectId = subjectData.id!;
    } else {
      resultSubjectId = crypto.randomUUID();
      subjects.push({
        id: resultSubjectId,
        subject: subjectData.subject,
        color: subjectData.color,
        topics: subjectData.topics,
      });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('study_plans')
      .update({ subjects })
      .eq('id', plan.id)
      .eq('user_id', userId);

    if (error) throw error;
    await recordStudentAudit(session, 'SUBJECT_SAVE', 'subject', resultSubjectId, {
      fileName,
      subject: subjectData.subject,
      isUpdate: existingSubjectIndex !== -1,
    });
    return { success: true, subjectId: resultSubjectId };
  } catch (error: any) {
    console.error(`Erro ao salvar a matéria em ${fileName}:`, error);
    return { success: false, error: error.message || 'Falha ao salvar a matéria.' };
  }
}

export async function updateTopicWeightAction(
  fileName: string,
  subjectId: string,
  topicText: string,
  newWeight: number
): Promise<{ success: boolean; error?: string }> {
  if (!fileName || !subjectId || !topicText || newWeight === undefined) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plano não encontrado.' };
    }

    const subjects: Subject[] = Array.isArray(plan.subjects) ? [...plan.subjects] : [];
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) {
      return { success: false, error: `Matéria com ID '${subjectId}' não encontrada.` };
    }

    const findAndApplyWeight = (topics: EditalTopic[]): boolean => {
      for (const topic of topics) {
        if (topic.topic_text === topicText) {
          topic.userWeight = newWeight;
          return true;
        }
        if (topic.sub_topics && findAndApplyWeight(topic.sub_topics)) {
          return true;
        }
      }
      return false;
    };

    const found = findAndApplyWeight(subject.topics as EditalTopic[]);
    if (!found) {
      return {
        success: false,
        error: `Tópico '${topicText}' não encontrado na matéria com ID '${subjectId}'.`,
      };
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('study_plans')
      .update({ subjects })
      .eq('id', plan.id)
      .eq('user_id', userId);

    if (error) throw error;
    await recordStudentAudit(session, 'TOPIC_WEIGHT_UPDATE', 'topic', topicText, {
      fileName,
      subjectId,
      newWeight,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao atualizar o peso do tópico:', error);
    return { success: false, error: error.message || 'Falha ao atualizar o peso do tópico.' };
  }
}

export async function migrateToSubjectIds(
  fileName: string
): Promise<{ success: boolean; migrated: boolean; error?: string }> {
  try {
    const userId = await getAuthenticatedUserId();
    const planData = await getFullPlanData(userId, fileName);
    if (!planData) {
      return { success: true, migrated: false };
    }

    let needsMigration = false;
    if (!planData.subjects || planData.subjects.some((s) => !s.id)) {
      needsMigration = true;
    }
    if (!needsMigration && planData.records?.some((r) => !r.subjectId)) {
      needsMigration = true;
    }

    if (!needsMigration) {
      return { success: true, migrated: false };
    }

    const subjectNameToId = new Map<string, string>();
    planData.subjects = planData.subjects.map((subject) => {
      if (!subject.id) {
        const newId = crypto.randomUUID();
        subjectNameToId.set(subject.subject, newId);
        return { ...subject, id: newId };
      }
      subjectNameToId.set(subject.subject, subject.id);
      return subject;
    });

    if (planData.records) {
      planData.records = planData.records.map((record) => {
        if (!record.subjectId && record.subject) {
          const subjectId = subjectNameToId.get(record.subject);
          if (subjectId) return { ...record, subjectId };
        }
        return record;
      });
    }

    if (planData.reviewRecords) {
      planData.reviewRecords = planData.reviewRecords.map((review) => {
        if (!review.subjectId && review.subject) {
          const subjectId = subjectNameToId.get(review.subject);
          if (subjectId) return { ...review, subjectId };
        }
        return review;
      });
    }

    if (planData.bancaTopicWeights) {
      const newBancaTopicWeights: PlanData['bancaTopicWeights'] = {};
      for (const subjectName in planData.bancaTopicWeights) {
        const subjectId = subjectNameToId.get(subjectName);
        if (subjectId) {
          newBancaTopicWeights[subjectId] = planData.bancaTopicWeights[subjectName];
        }
      }
      planData.bancaTopicWeights = newBancaTopicWeights;
    }

    await upsertFullPlanData(userId, fileName, planData);
    return { success: true, migrated: true };
  } catch (error: any) {
    console.error(`Erro ao migrar para Subject IDs para ${fileName}:`, error);
    return { success: false, migrated: false, error: error.message };
  }
}

export async function updateAllTopicWeightsAction(
  fileName: string,
  weightMap: { [subjectId: string]: { [topicText: string]: number } }
): Promise<{ success: boolean; error?: string }> {
  if (!fileName || !weightMap) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plano não encontrado.' };
    }

    const subjects: Subject[] = Array.isArray(plan.subjects) ? [...plan.subjects] : [];
    for (const subjectId in weightMap) {
      const subject = subjects.find((s) => s.id === subjectId);
      if (subject) {
        const topicWeightsForSubject = weightMap[subjectId];
        const findAndApplyWeight = (topics: EditalTopic[]) => {
          for (const topic of topics) {
            if (topicWeightsForSubject[topic.topic_text] !== undefined) {
              topic.userWeight = topicWeightsForSubject[topic.topic_text];
            }
            if (topic.sub_topics) {
              findAndApplyWeight(topic.sub_topics);
            }
          }
        };
        findAndApplyWeight(subject.topics as EditalTopic[]);
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('study_plans')
      .update({ subjects })
      .eq('id', plan.id)
      .eq('user_id', userId);

    if (error) throw error;
    await recordStudentAudit(session, 'TOPIC_WEIGHTS_BULK_UPDATE', 'plan', fileName, {
      subjectsUpdated: Object.keys(weightMap).length,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao atualizar todos os pesos de tópicos:', error);
    return { success: false, error: error.message || 'Falha ao atualizar pesos de tópicos.' };
  }
}

export async function importEditalMutationAction(options: {
  mode: 'new' | 'append';
  targetPlanFile?: string;
  newPlanName?: string;
  cargo?: string;
  edital?: string;
  subjects: any[];
}): Promise<{ success: boolean; fileName?: string; error?: string }> {
  try {
    const userId = await getAuthenticatedUserId();

    const formatSubjectsWithIds = (subs: any[]): Subject[] => {
      return subs.map((s) => ({
        id: s.id || crypto.randomUUID(),
        subject: s.subject,
        color: s.color || '#10B981',
        topics: s.topics || [],
      }));
    };

    if (options.mode === 'new' || !options.targetPlanFile) {
      const rawName = (options.newPlanName || 'Meu Plano de Estudos').trim();
      const safeSlug =
        rawName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `plano-${Date.now()}`;
      const fileName = `${safeSlug}.json`;

      const newPlanData: PlanData = {
        name: rawName,
        observations: 'Importado via Assistente de IA',
        cargo: options.cargo || '',
        edital: options.edital || '',
        subjects: formatSubjectsWithIds(options.subjects),
        records: [],
        reviewRecords: [],
        simuladoRecords: [],
      };

      await upsertFullPlanData(userId, fileName, newPlanData);
      await recordStudentAudit(session, 'EDITAL_IMPORT', 'plan', fileName, {
        mode: 'new',
        subjectsCount: newPlanData.subjects.length,
      });
      return { success: true, fileName };
    } else {
      const fileName = normalizePlanFileName(options.targetPlanFile);
      const plan = await getPlanMeta(userId, fileName);
      if (!plan) {
        return { success: false, error: 'Plano de destino não encontrado.' };
      }

      const subjects: Subject[] = Array.isArray(plan.subjects) ? [...plan.subjects] : [];
      const incoming = formatSubjectsWithIds(options.subjects);

      for (const inc of incoming) {
        const existingIdx = subjects.findIndex(
          (s) => s.subject.toLowerCase() === inc.subject.toLowerCase()
        );
        if (existingIdx !== -1) {
          subjects[existingIdx].topics = [...(subjects[existingIdx].topics || []), ...inc.topics];
        } else {
          subjects.push(inc);
        }
      }

      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from('study_plans')
        .update({ subjects })
        .eq('id', plan.id)
        .eq('user_id', userId);

      if (error) throw error;
      await recordStudentAudit(session, 'EDITAL_IMPORT', 'plan', fileName, {
        mode: 'append',
        subjectsCount: incoming.length,
      });
      return { success: true, fileName };
    }
  } catch (error: any) {
    console.error('Erro ao importar edital via IA:', error);
    return { success: false, error: error.message || 'Falha ao importar edital.' };
  }
}

export async function updateTopicDetailsAction(
  fileName: string,
  subjectNameOrId: string,
  topicText: string,
  patch: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!fileName || !subjectNameOrId || !topicText) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  try {
    const session = await requireStudentSession();
    const userId = session.userId;
    const plan = await getPlanMeta(userId, fileName);
    if (!plan) {
      return { success: false, error: 'Plano não encontrado.' };
    }

    const subjects: Subject[] = Array.isArray(plan.subjects) ? [...plan.subjects] : [];
    const subject = subjects.find(
      (s) => s.id === subjectNameOrId || s.subject === subjectNameOrId
    );
    if (!subject) {
      return { success: false, error: 'Disciplina não encontrada.' };
    }

    const updateRecursive = (topics: any[]): boolean => {
      for (let i = 0; i < topics.length; i++) {
        if (topics[i].topic_text === topicText) {
          topics[i] = { ...topics[i], ...patch };
          return true;
        }
        if (topics[i].sub_topics && updateRecursive(topics[i].sub_topics)) {
          return true;
        }
      }
      return false;
    };

    const updated = updateRecursive(subject.topics || []);
    if (!updated) {
      return { success: false, error: 'Tópico não encontrado.' };
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('study_plans')
      .update({ subjects })
      .eq('id', plan.id)
      .eq('user_id', userId);

    if (error) throw error;
    await recordStudentAudit(session, 'TOPIC_DETAILS_UPDATE', 'topic', topicText, {
      fileName,
      subjectNameOrId,
      patchKeys: Object.keys(patch),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao atualizar detalhes do tópico:', error);
    return { success: false, error: error.message || 'Falha ao atualizar tópico.' };
  }
}
