import 'server-only';
import { getSupabaseAdmin } from './supabase';
import { encryptApiKey, decryptApiKey, maskApiKey } from './cryptoKeys';

const AI_KEYS_SENTINEL_PLAN = '__user_encrypted_ai_keys__';

export interface UserEncryptedKeysRecord {
  encryptedDeepseekKey?: string;
  encryptedGeminiKey?: string;
  encryptedGroqKey?: string;
  updatedAt?: string;
}

export async function getUserDecryptedAiKeys(userId: string): Promise<{
  deepseekKey: string | null;
  geminiKey: string | null;
  groqKey: string | null;
}> {
  if (!userId) {
    return { deepseekKey: null, geminiKey: null, groqKey: null };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('study_cycles')
      .select('id, reminder_notes')
      .eq('user_id', userId)
      .eq('plan_file_name', AI_KEYS_SENTINEL_PLAN)
      .maybeSingle();

    const rawNotes = data?.reminder_notes;
    const keyObj: UserEncryptedKeysRecord =
      rawNotes && !Array.isArray(rawNotes) && typeof rawNotes === 'object'
        ? (rawNotes as UserEncryptedKeysRecord)
        : Array.isArray(rawNotes) && rawNotes[0] && typeof rawNotes[0] === 'object'
        ? (rawNotes[0] as UserEncryptedKeysRecord)
        : {};

    let deepseekKey = decryptApiKey(keyObj.encryptedDeepseekKey);
    const geminiKey = decryptApiKey(keyObj.encryptedGeminiKey);
    const groqKey = decryptApiKey(keyObj.encryptedGroqKey);

    // Se o usuário principal ainda não tiver chave salva no banco mas houver uma chave inicial no .env.local,
    // criptografa e salva automaticamente no banco para o usuário atual.
    if (!deepseekKey && process.env.DEEPSEEK_API_KEY?.trim()) {
      const envKey = process.env.DEEPSEEK_API_KEY.trim();
      await saveUserEncryptedAiKeys(userId, { deepseekKey: envKey });
      deepseekKey = envKey;
    }

    return {
      deepseekKey,
      geminiKey,
      groqKey,
    };
  } catch (err) {
    console.error('Erro ao buscar chaves criptografadas do usuário:', err);
    return { deepseekKey: null, geminiKey: null, groqKey: null };
  }
}

export async function getUserMaskedAiKeysStatus(userId: string): Promise<{
  hasDeepseekKey: boolean;
  maskedDeepseekKey: string | null;
  hasGeminiKey: boolean;
  maskedGeminiKey: string | null;
}> {
  const { deepseekKey, geminiKey } = await getUserDecryptedAiKeys(userId);
  return {
    hasDeepseekKey: Boolean(deepseekKey),
    maskedDeepseekKey: maskApiKey(deepseekKey),
    hasGeminiKey: Boolean(geminiKey),
    maskedGeminiKey: maskApiKey(geminiKey),
  };
}

export async function saveUserEncryptedAiKeys(
  userId: string,
  input: {
    deepseekKey?: string | null;
    geminiKey?: string | null;
    groqKey?: string | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('study_cycles')
    .select('id, reminder_notes')
    .eq('user_id', userId)
    .eq('plan_file_name', AI_KEYS_SENTINEL_PLAN)
    .maybeSingle();

  const rawNotes = existing?.reminder_notes;
  const currentObj: UserEncryptedKeysRecord =
    rawNotes && !Array.isArray(rawNotes) && typeof rawNotes === 'object'
      ? (rawNotes as UserEncryptedKeysRecord)
      : Array.isArray(rawNotes) && rawNotes[0] && typeof rawNotes[0] === 'object'
      ? (rawNotes[0] as UserEncryptedKeysRecord)
      : {};

  const nextObj: UserEncryptedKeysRecord = {
    ...currentObj,
    updatedAt: new Date().toISOString(),
  };

  if (input.deepseekKey !== undefined) {
    nextObj.encryptedDeepseekKey = input.deepseekKey?.trim()
      ? encryptApiKey(input.deepseekKey.trim())
      : '';
  }
  if (input.geminiKey !== undefined) {
    nextObj.encryptedGeminiKey = input.geminiKey?.trim()
      ? encryptApiKey(input.geminiKey.trim())
      : '';
  }
  if (input.groqKey !== undefined) {
    nextObj.encryptedGroqKey = input.groqKey?.trim()
      ? encryptApiKey(input.groqKey.trim())
      : '';
  }

  await supabase.from('study_cycles').upsert(
    {
      user_id: userId,
      plan_file_name: AI_KEYS_SENTINEL_PLAN,
      study_cycle: [],
      study_hours: '0',
      weekly_questions_goal: '0',
      current_progress_minutes: 0,
      session_progress_map: {},
      reminder_notes: [nextObj],
      study_days: [],
      completed_cycles: 0,
    },
    { onConflict: 'user_id,plan_file_name' }
  );
}
