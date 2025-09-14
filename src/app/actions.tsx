'use server';

import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { EditalTopic, EditalSubject as Subject } from '@/context/DataContext';

export interface StudyRecord {
  id: string;
  date: string;
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
  subject: string;
  topic: string;
  reviewPeriod: string;
  completedDate?: string;
  ignored?: boolean;
}

export interface SimuladoSubject {
  name: string;
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
    [subjectName: string]: {
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

async function getUserDataDirectory(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    throw new Error('Usuário não autenticado.');
  }
  const userDir = path.join(process.cwd(), 'data', session.user.id);
  await fs.mkdir(userDir, { recursive: true });
  return userDir;
}

export async function saveStudyCycleToFile(planFileName: string, cycleData: StudyCycleData): Promise<{ success: boolean; error?: string }> {
  if (!planFileName) {
    return { success: false, error: 'Nome do arquivo do plano não fornecido.' };
  }
  const cycleFileName = planFileName.replace('.json', '.cycle.json');
  const userDir = await getUserDataDirectory();
  const filePath = path.join(userDir, cycleFileName);
  try {
    await fs.writeFile(filePath, JSON.stringify(cycleData, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Erro ao salvar o arquivo do ciclo ${cycleFileName}:`, error);
    return { success: false, error: 'Falha ao salvar o ciclo de estudos.' };
  }
}

export async function getStudyCycleFromFile(planFileName: string): Promise<StudyCycleData | null> {
  if (!planFileName) return null;
  const cycleFileName = planFileName.replace('.json', '.cycle.json');
  const userDir = await getUserDataDirectory();
  const filePath = path.join(userDir, cycleFileName);
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
       console.error(`Erro ao ler o arquivo do ciclo ${cycleFileName}:`, error);
    }
    return null;
  }
}

export async function deleteStudyCycleFile(planFileName: string): Promise<{ success: boolean; error?: string }> {
    if (!planFileName) {
    return { success: false, error: 'Nome do arquivo do plano não fornecido.' };
  }
  const cycleFileName = planFileName.replace('.json', '.cycle.json');
  const userDir = await getUserDataDirectory();
  const filePath = path.join(userDir, cycleFileName);
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
     if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { success: true };
    }
    console.error(`Erro ao deletar o arquivo do ciclo ${cycleFileName}:`, error);
    return { success: false, error: 'Falha ao deletar o arquivo do ciclo.' };
  }
}

export async function getJsonFiles(): Promise<string[]> {
  const dataDir = await getUserDataDirectory();
  try {
    const files = await fs.readdir(dataDir);
    return files.filter(file => file.endsWith('.json') && !file.endsWith('.cycle.json'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to read data directory:', error);
    return [];
  }
}

export async function deleteJsonFile(fileName: string): Promise<void> {
  const dataDir = await getUserDataDirectory();
  const filePath = path.join(dataDir, fileName);
  try {
    await fs.unlink(filePath);
    console.log(`Successfully deleted ${fileName}`);
  } catch (error) {
    console.error(`Error deleting file ${fileName}:`, error);
    throw new Error(`Failed to delete plan: ${fileName}`);
  }
}

export async function getJsonContent(fileName: string) {
  if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
    console.error('getJsonContent called with invalid fileName:', fileName);
    return null;
  }
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading ${fileName}:`, error);
    return null;
  }
}

export async function saveStudyRecord(fileName: string, record: StudyRecord): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    let planData: PlanData = await fs.access(filePath).then(async () => {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }).catch(() => ({ name: '', observations: '', subjects: [] }));
    if (!planData.records) planData.records = [];
    const existingIndex = planData.records.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      planData.records[existingIndex] = record;
    } else {
      planData.records.push(record);
    }
    await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
  } catch (error) {
    console.error('Error saving study record:', error);
    throw error;
  }
}

export async function getStudyRecords(fileName: string): Promise<StudyRecord[]> {
  try {
    const planData = await getJsonContent(fileName);
    return planData?.records || [];
  } catch (error) {
    console.error('Error reading study records:', error);
    return [];
  }
}

export async function saveReviewRecord(fileName: string, record: ReviewRecord): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    const planData: PlanData = await fs.access(filePath).then(async () => {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }).catch(() => ({ name: '', observations: '', subjects: [] }));
    if (!planData.reviewRecords) planData.reviewRecords = [];
    const existingIndex = planData.reviewRecords.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      planData.reviewRecords[existingIndex] = record;
    } else {
      planData.reviewRecords.push(record);
    }
    await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
  } catch (error) {
    console.error('Error saving review record:', error);
    throw error;
  }
}

export async function getReviewRecords(fileName: string): Promise<ReviewRecord[]> {
  try {
    const planData = await getJsonContent(fileName);
    return planData?.reviewRecords || [];
  } catch (error) {
    console.error('Error reading review records:', error);
    return [];
  }
}

export async function saveSimuladoRecord(fileName: string, record: SimuladoRecord): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    let planData: PlanData = await fs.access(filePath).then(async () => {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }).catch(() => ({ name: '', observations: '', subjects: [] }));
    if (!planData.simuladoRecords) planData.simuladoRecords = [];
    const existingIndex = planData.simuladoRecords.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      planData.simuladoRecords[existingIndex] = record;
    } else {
      planData.simuladoRecords.push(record);
    }
    await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
  } catch (error) {
    console.error('Error saving simulado record:', error);
    throw error;
  }
}

export async function getSimuladoRecords(fileName: string): Promise<SimuladoRecord[]> {
  try {
    const planData = await getJsonContent(fileName);
    return planData?.simuladoRecords || [];
  } catch (error) {
    console.error('Error reading simulado records:', error);
    return [];
  }
}

export async function migrateStudyRecordIds(fileName: string) {
  const userDir = await getUserDataDirectory();
  const filePath = path.join(userDir, fileName);
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    if (!data || !Array.isArray(data.records)) return { success: true, migrated: false };
    let recordsChanged = false;
    const updatedRecords = data.records.map((record: any) => {
      if (!record.id) {
        recordsChanged = true;
        return { ...record, id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-migrated` };
      }
      return record;
    });
    if (recordsChanged) {
      data.records = updatedRecords;
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    return { success: true, migrated: false };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { success: true, migrated: false };
    console.error(`Error migrating IDs for ${fileName}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteStudyRecordAction(fileName: string, recordId: string): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    let planData: PlanData | null = await getJsonContent(fileName);
    if (planData && planData.records) {
      const initialLength = planData.records.length;
      planData.records = planData.records.filter(r => r.id !== recordId);
      if (planData.records.length < initialLength) {
        if (planData.reviewRecords) {
          planData.reviewRecords = planData.reviewRecords.filter(rr => rr.studyRecordId !== recordId);
        }
        await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
      }
    }
  } catch (error) {
    console.error('Error deleting study record:', error);
    throw error;
  }
}

export async function createPlanFile(formData: FormData): Promise<{ success: boolean; fileName?: string; error?: string }> {
  const planName = formData.get('name') as string;
  const observations = formData.get('observations') as string;
  const cargo = (formData.get('cargo') as string) || '';
  const edital = (formData.get('edital') as string) || '';
  const imageFile = formData.get('image') as File;
  if (!planName || planName.trim() === '') return { success: false, error: 'O nome do plano não pode estar vazio.' };
  const sanitizedPlanName = planName.trim().toLowerCase().replace(/\s+/g, '-');
  const jsonFileName = `${sanitizedPlanName}.json`;
  const userDir = await getUserDataDirectory();
  const jsonFilePath = path.join(userDir, jsonFileName);
  try {
    await fs.access(jsonFilePath);
    return { success: false, error: `O plano '${planName}' já existe.` };
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.error('Erro ao verificar arquivo existente:', error);
      return { success: false, error: 'Erro interno do servidor.' };
    }
  }
  let iconUrl: string | undefined = undefined;
  if (imageFile && imageFile.size > 0) {
    try {
      const publicDir = path.join(process.cwd(), 'public', 'plan-icons');
      await fs.mkdir(publicDir, { recursive: true });
      const imageExtension = path.extname(imageFile.name);
      const imageFileName = `${sanitizedPlanName}-${Date.now()}${imageExtension}`;
      const imageFilePath = path.join(publicDir, imageFileName);
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      await fs.writeFile(imageFilePath, buffer);
      iconUrl = `/plan-icons/${imageFileName}`;
    } catch (error) {
      console.error('Erro ao salvar a imagem:', error);
      return { success: false, error: 'Falha ao salvar a imagem do plano.' };
    }
  }
  const planContent: PlanData = {
    name: planName.trim(),
    observations: observations.trim(),
    cargo: cargo.trim(),
    edital: edital.trim(),
    iconUrl: iconUrl,
    subjects: [],
    records: [],
    reviewRecords: [],
  };
  const initialJsonContent = JSON.stringify(planContent, null, 2);
  try {
    await fs.writeFile(jsonFilePath, initialJsonContent, 'utf-8');
    return { success: true, fileName: jsonFileName };
  } catch (error) {
    console.error(`Erro ao criar o arquivo do plano ${jsonFileName}:`, error);
    return { success: false, error: 'Falha ao criar o arquivo do plano.' };
  }
}

export async function updatePlanFile(fileName: string, updatedData: Partial<PlanData>): Promise<{ success: boolean; error?: string }> {
  if (!fileName || fileName.trim() === '') return { success: false, error: 'File name cannot be empty.' };
  const jsonFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  const userDir = await getUserDataDirectory();
  const jsonFilePath = path.join(userDir, jsonFileName);
  try {
    const fileContent = await fs.readFile(jsonFilePath, 'utf-8');
    const currentData: PlanData = JSON.parse(fileContent);
    const newData = { ...currentData, ...updatedData };
    const updatedContent = JSON.stringify(newData, null, 2);
    await fs.writeFile(jsonFilePath, updatedContent, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Error updating plan file ${jsonFileName}:`, error);
    return { success: false, error: 'Failed to update the plan file.' };
  }
}

export async function deletePlanFile(fileName: string): Promise<{ success: boolean; error?: string }> {
  if (!fileName || fileName.trim() === '') return { success: false, error: 'File name cannot be empty.' };
  const jsonFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
  const userDir = await getUserDataDirectory();
  const jsonFilePath = path.join(userDir, jsonFileName);
  try {
    await fs.unlink(jsonFilePath);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting plan file ${jsonFileName}:`, error);
    return { success: false, error: 'Failed to delete the plan file.' };
  }
}

export async function uploadImage(formData: FormData): Promise<{ success: boolean; iconUrl?: string; error?: string }> {
  const imageFile = formData.get('imageFile') as File;
  const baseName = formData.get('baseName') as string;
  if (!imageFile || imageFile.size === 0) return { success: false, error: 'No image file provided.' };
  if (!baseName) return { success: false, error: 'Base name for the image was not provided.' };
  try {
    const publicDir = path.join(process.cwd(), 'public', 'plan-icons');
    await fs.mkdir(publicDir, { recursive: true });
    const sanitizedBaseName = baseName.trim().toLowerCase().replace(/\s+/g, '-');
    const imageExtension = path.extname(imageFile.name);
    const imageFileName = `${sanitizedBaseName}-${Date.now()}${imageExtension}`;
    const imageFilePath = path.join(publicDir, imageFileName);
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    await fs.writeFile(imageFilePath, buffer);
    const iconUrl = `/plan-icons/${imageFileName}`;
    return { success: true, iconUrl };
  } catch (error) {
    console.error('Error saving image:', error);
    return { success: false, error: 'Failed to save the image.' };
  }
}

export async function updateSimuladoRecord(fileName: string, record: SimuladoRecord): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    let planData: PlanData = await fs.access(filePath).then(async () => {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }).catch(() => ({ name: '', observations: '', subjects: [] }));
    if (!planData.simuladoRecords) planData.simuladoRecords = [];
    const existingIndex = planData.simuladoRecords.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      planData.simuladoRecords[existingIndex] = record;
    } else {
      planData.simuladoRecords.push(record);
    }
    await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
  } catch (error) {
    console.error('Error updating simulado record:', error);
    throw error;
  }
}

export async function deleteSimuladoRecordAction(fileName: string, recordId: string): Promise<void> {
  try {
    const dataDir = await getUserDataDirectory();
    const filePath = path.join(dataDir, fileName);
    let planData: PlanData | null = await getJsonContent(fileName);
    if (planData && planData.simuladoRecords) {
      const initialLength = planData.simuladoRecords.length;
      planData.simuladoRecords = planData.simuladoRecords.filter(r => r.id !== recordId);
      if (planData.simuladoRecords.length < initialLength) {
        await fs.writeFile(filePath, JSON.stringify(planData, null, 2));
      }
    }
  } catch (error) {
    console.error('Error deleting simulado record:', error);
    throw error;
  }
}

export async function exportFullBackupAction(): Promise<any> {
  const dataDir = await getUserDataDirectory();
  const planFiles = await getJsonFiles();
  const allPlansData = [];
  for (const fileName of planFiles) {
    const planContent = await getJsonContent(fileName);
    if (planContent) {
      allPlansData.push({ fileName: fileName, content: planContent });
    }
  }
  return { plans: allPlansData };
}

export async function restoreFullBackupAction(backupData: { plans: { fileName: string, content: any }[] }): Promise<{ success: boolean; error?: string }> {
  const dataDir = await getUserDataDirectory();
  try {
    const existingFiles = await fs.readdir(dataDir);
    for (const file of existingFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(dataDir, file));
      }
    }
    if (!backupData.plans || !Array.isArray(backupData.plans)) {
      throw new Error("Backup data is missing 'plans' array or is invalid.");
    }
    for (const plan of backupData.plans) {
      const filePath = path.join(dataDir, plan.fileName);
      await fs.writeFile(filePath, JSON.stringify(plan.content, null, 2), 'utf-8');
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error during backup restoration:', error);
    return { success: false, error: error.message || 'Failed to restore backup.' };
  }
}

export async function clearAllDataAction(): Promise<{ success: boolean; error?: string }> {
  const dataDir = await getUserDataDirectory();
  try {
    const existingFiles = await fs.readdir(dataDir);
    for (const file of existingFiles) {
      if (file.endsWith('.json') || file.endsWith('.cycle.json')) {
        await fs.unlink(path.join(dataDir, file));
      }
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error clearing all data:', error);
    return { success: false, error: error.message || 'Failed to clear all data.' };
  }
}

export async function exportAllDataAction(): Promise<any> {
  const dataDir = await getUserDataDirectory();
  const planFiles = await getJsonFiles();
  const allPlansData = [];
  for (const fileName of planFiles) {
    const planContent = await getJsonContent(fileName);
    if (planContent) {
      allPlansData.push({ fileName: fileName, content: planContent });
    }
  }
  return { plans: allPlansData };
}

export async function updateTopicWeightAction(
  fileName: string,
  subjectName: string,
  topicText: string,
  newWeight: number
): Promise<{ success: boolean; error?: string }> {
  if (!fileName || !subjectName || !topicText || newWeight === undefined) {
    return { success: false, error: 'Parâmetros inválidos.' };
  }

  const userDir = await getUserDataDirectory();
  const filePath = path.join(userDir, fileName);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const planData: PlanData = JSON.parse(fileContent);

    const subject = planData.subjects.find(s => s.subject === subjectName);
    if (!subject) {
      return { success: false, error: `Matéria '${subjectName}' não encontrada.` };
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
      return { success: false, error: `Tópico '${topicText}' não encontrado na matéria '${subjectName}'.` };
    }

    await fs.writeFile(filePath, JSON.stringify(planData, null, 2), 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao atualizar o peso do tópico:', error);
    return { success: false, error: error.message || 'Falha ao atualizar o peso do tópico.' };
  }
}