import 'server-only';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;
let localDbInstance: any = null;

interface LocalDbStore {
  users: any[];
  admin_users: any[];
  audit_logs: any[];
  study_plans: any[];
  study_records: any[];
  review_records: any[];
  simulado_records: any[];
  study_cycles: any[];
}

function getLocalDbFilePath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, '_local_supabase_db.json');
}

function seedLocalDbFromLegacyFiles(): LocalDbStore {
  const store: LocalDbStore = {
    users: [],
    admin_users: [],
    audit_logs: [],
    study_plans: [],
    study_records: [],
    review_records: [],
    simulado_records: [],
    study_cycles: [],
  };

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const usersFile = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersFile)) {
      const legacyUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      if (Array.isArray(legacyUsers)) {
        for (const u of legacyUsers) {
          if (u && u.id && u.username) {
            store.users.push({
              id: String(u.id),
              username: String(u.username),
              password_hash: String(u.password || u.password_hash || ''),
              status: u.status || 'approved',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Importa os planos e ciclos existentes nas pastas data/<userId>/
    for (const user of store.users) {
      const userDir = path.join(dataDir, user.id);
      if (!fs.existsSync(userDir) || !fs.statSync(userDir).isDirectory()) continue;

      const files = fs.readdirSync(userDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const fullPath = path.join(userDir, file);

        if (file.endsWith('.cycle.json')) {
          try {
            const cycleContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            const planFileName = file.replace(/\.cycle\.json$/i, '.json');
            store.study_cycles.push({
              id: crypto.randomUUID(),
              user_id: user.id,
              plan_file_name: planFileName,
              study_cycle: Array.isArray(cycleContent.studyCycle) ? cycleContent.studyCycle : [],
              study_hours: String(cycleContent.studyHours ?? '24'),
              weekly_questions_goal: String(cycleContent.weeklyQuestionsGoal ?? '250'),
              current_progress_minutes: Number(cycleContent.currentProgressMinutes ?? 0),
              session_progress_map: cycleContent.sessionProgressMap || {},
              reminder_notes: Array.isArray(cycleContent.reminderNotes)
                ? cycleContent.reminderNotes
                : [],
              study_days: Array.isArray(cycleContent.studyDays) ? cycleContent.studyDays : [],
              completed_cycles: Number(cycleContent.completedCycles ?? 0),
              cycle_generation_timestamp: cycleContent.cycleGenerationTimestamp ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } catch {}
        } else {
          try {
            const planContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            const planId = crypto.randomUUID();
            const isArrayFormat = Array.isArray(planContent);
            const subjects = isArrayFormat
              ? planContent
              : Array.isArray(planContent.subjects)
              ? planContent.subjects
              : [];

            store.study_plans.push({
              id: planId,
              user_id: user.id,
              file_name: file.toLowerCase(),
              name: isArrayFormat
                ? file.replace(/\.json$/i, '')
                : planContent.name || file.replace(/\.json$/i, ''),
              observations: planContent.observations || '',
              cargo: planContent.cargo || '',
              edital: planContent.edital || '',
              icon_url: planContent.iconUrl || null,
              subjects,
              banca_topic_weights: planContent.bancaTopicWeights || {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            if (Array.isArray(planContent.studyRecords)) {
              for (const rec of planContent.studyRecords) {
                store.study_records.push({
                  id: String(rec.id || crypto.randomUUID()),
                  plan_id: planId,
                  user_id: user.id,
                  date: String(rec.date || ''),
                  subject_id: String(rec.subjectId || ''),
                  subject: String(rec.subject || ''),
                  topic: String(rec.topic || ''),
                  study_time: Number(rec.studyTime || 0),
                  questions: rec.questions || { correct: 0, total: 0 },
                  pages: Array.isArray(rec.pages) ? rec.pages : [],
                  videos: Array.isArray(rec.videos) ? rec.videos : [],
                  notes: String(rec.notes || ''),
                  category: String(rec.category || 'teoria'),
                  review_periods: Array.isArray(rec.reviewPeriods) ? rec.reviewPeriods : [],
                  teoria_finalizada: Boolean(rec.teoriaFinalizada),
                  count_in_planning:
                    rec.countInPlanning !== undefined ? Boolean(rec.countInPlanning) : true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            }

            if (Array.isArray(planContent.reviewRecords)) {
              for (const rev of planContent.reviewRecords) {
                store.review_records.push({
                  id: String(rev.id || crypto.randomUUID()),
                  plan_id: planId,
                  user_id: user.id,
                  study_record_id: String(rev.studyRecordId || ''),
                  scheduled_date: String(rev.scheduledDate || ''),
                  status: String(rev.status || 'pending'),
                  original_date: String(rev.originalDate || ''),
                  subject_id: String(rev.subjectId || ''),
                  subject: String(rev.subject || ''),
                  topic: String(rev.topic || ''),
                  review_period: String(rev.reviewPeriod || ''),
                  completed_date: rev.completedDate || null,
                  ignored: Boolean(rev.ignored),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            }

            if (Array.isArray(planContent.simuladoRecords)) {
              for (const sim of planContent.simuladoRecords) {
                store.simulado_records.push({
                  id: String(sim.id || crypto.randomUUID()),
                  plan_id: planId,
                  user_id: user.id,
                  date: String(sim.date || ''),
                  name: String(sim.name || ''),
                  style: String(sim.style || ''),
                  banca: String(sim.banca || ''),
                  time_spent: String(sim.timeSpent || ''),
                  subjects: Array.isArray(sim.subjects) ? sim.subjects : [],
                  comments: String(sim.comments || ''),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Aviso ao importar dados locais legados:', err);
  }

  return store;
}

function loadLocalDb(): LocalDbStore {
  const dbPath = getLocalDbFilePath();
  if (fs.existsSync(dbPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (parsed && Array.isArray(parsed.users)) {
        return parsed;
      }
    } catch {}
  }
  const seeded = seedLocalDbFromLegacyFiles();
  saveLocalDb(seeded);
  return seeded;
}

function saveLocalDb(store: LocalDbStore) {
  try {
    const dbPath = getLocalDbFilePath();
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar banco local:', err);
  }
}

class LocalQueryBuilder {
  private table: keyof LocalDbStore;
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private filters: Array<(row: any) => boolean> = [];
  private orderSpecs: Array<{ col: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private rangeSpec: { from: number; to: number } | null = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
  private payload: any = null;
  private upsertConflictCols: string[] = [];
  private countMode: boolean = false;
  private headMode: boolean = false;

  constructor(table: keyof LocalDbStore) {
    this.table = table;
  }

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.op = 'select';
    }
    if (options?.count) this.countMode = true;
    if (options?.head) this.headMode = true;
    return this;
  }

  insert(values: any) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.op = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = values;
    this.upsertConflictCols = options?.onConflict
      ? options.onConflict.split(',').map((s) => s.trim())
      : ['id'];
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => String(row?.[col] ?? '') === String(val ?? ''));
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((row) => String(row?.[col] ?? '') !== String(val ?? ''));
    return this;
  }

  in(col: string, vals: any[]) {
    const set = new Set((vals || []).map((v) => String(v)));
    this.filters.push((row) => set.has(String(row?.[col] ?? '')));
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = String(pattern || '').replace(/%/g, '').toLowerCase();
    this.filters.push((row) =>
      String(row?.[col] ?? '')
        .toLowerCase()
        .includes(clean)
    );
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderSpecs.push({ col, ascending: options?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeSpec = { from, to };
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private execute(): { data: any; error: any; count?: number } {
    try {
      const store = loadLocalDb();
      if (!Array.isArray(store[this.table])) {
        store[this.table] = [];
      }
      const rows = store[this.table];

      const matches = (row: any) => this.filters.every((fn) => fn(row));

      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = items.map((item) => ({
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          ...item,
        }));
        rows.push(...inserted);
        saveLocalDb(store);
        const out =
          this.singleMode !== 'none' ? inserted[0] ?? null : inserted;
        return { data: out, error: null };
      }

      if (this.op === 'update') {
        const updated: any[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (matches(rows[i])) {
            rows[i] = {
              ...rows[i],
              ...this.payload,
              updated_at: new Date().toISOString(),
            };
            updated.push(rows[i]);
          }
        }
        saveLocalDb(store);
        const out =
          this.singleMode !== 'none' ? updated[0] ?? null : updated;
        return { data: out, error: null };
      }

      if (this.op === 'upsert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const upserted: any[] = [];
        for (const item of items) {
          const idx = rows.findIndex((r) =>
            this.upsertConflictCols.every(
              (c) =>
                item[c] !== undefined &&
                String(r?.[c] ?? '') === String(item[c] ?? '')
            )
          );
          if (idx !== -1) {
            rows[idx] = {
              ...rows[idx],
              ...item,
              updated_at: new Date().toISOString(),
            };
            upserted.push(rows[idx]);
          } else {
            const newRow = {
              id: item.id || crypto.randomUUID(),
              created_at: item.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...item,
            };
            rows.push(newRow);
            upserted.push(newRow);
          }
        }
        saveLocalDb(store);
        const out =
          this.singleMode !== 'none' ? upserted[0] ?? null : upserted;
        return { data: out, error: null };
      }

      if (this.op === 'delete') {
        const remaining: any[] = [];
        const deleted: any[] = [];
        for (const r of rows) {
          if (matches(r)) {
            deleted.push(r);
          } else {
            remaining.push(r);
          }
        }
        store[this.table] = remaining;
        saveLocalDb(store);
        return { data: deleted, error: null };
      }

      // SELECT
      let result = rows.filter(matches);
      const totalCount = result.length;

      for (const spec of this.orderSpecs) {
        result.sort((a, b) => {
          const va = a?.[spec.col] ?? '';
          const vb = b?.[spec.col] ?? '';
          if (va < vb) return spec.ascending ? -1 : 1;
          if (va > vb) return spec.ascending ? 1 : -1;
          return 0;
        });
      }

      if (this.rangeSpec) {
        result = result.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
      } else if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }

      if (this.headMode) {
        return { data: null, error: null, count: totalCount };
      }

      if (this.singleMode === 'maybeSingle') {
        return { data: result[0] ?? null, error: null, count: totalCount };
      }
      if (this.singleMode === 'single') {
        if (result.length === 0) {
          return {
            data: null,
            error: { message: 'Row not found', code: 'PGRST116' },
          };
        }
        return { data: result[0], error: null, count: totalCount };
      }

      return { data: result, error: null, count: totalCount };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class HybridQueryBuilder {
  private table: keyof LocalDbStore;
  private remoteBuilder: any;
  private localBuilder: LocalQueryBuilder;
  private remoteClient: SupabaseClient;
  private isWriteOp: boolean = false;

  constructor(table: keyof LocalDbStore, remoteClient: SupabaseClient) {
    this.table = table;
    this.remoteClient = remoteClient;
    this.remoteBuilder = remoteClient.from(table as string);
    this.localBuilder = new LocalQueryBuilder(table);
  }

  select(columns = '*', options?: { count?: any; head?: boolean }) {
    this.remoteBuilder = this.remoteBuilder.select(columns, options);
    this.localBuilder.select(columns, options);
    return this;
  }

  insert(values: any) {
    this.isWriteOp = true;
    this.remoteBuilder = this.remoteBuilder.insert(values);
    this.localBuilder.insert(values);
    return this;
  }

  update(values: any) {
    this.isWriteOp = true;
    this.remoteBuilder = this.remoteBuilder.update(values);
    this.localBuilder.update(values);
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.isWriteOp = true;
    this.remoteBuilder = this.remoteBuilder.upsert(values, options);
    this.localBuilder.upsert(values, options);
    return this;
  }

  delete() {
    this.isWriteOp = true;
    this.remoteBuilder = this.remoteBuilder.delete();
    this.localBuilder.delete();
    return this;
  }

  eq(col: string, val: any) {
    this.remoteBuilder = this.remoteBuilder.eq(col, val);
    this.localBuilder.eq(col, val);
    return this;
  }

  neq(col: string, val: any) {
    this.remoteBuilder = this.remoteBuilder.neq(col, val);
    this.localBuilder.neq(col, val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.remoteBuilder = this.remoteBuilder.in(col, vals);
    this.localBuilder.in(col, vals);
    return this;
  }

  ilike(col: string, pattern: string) {
    this.remoteBuilder = this.remoteBuilder.ilike(col, pattern);
    this.localBuilder.ilike(col, pattern);
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.remoteBuilder = this.remoteBuilder.order(col, options);
    this.localBuilder.order(col, options);
    return this;
  }

  limit(n: number) {
    this.remoteBuilder = this.remoteBuilder.limit(n);
    this.localBuilder.limit(n);
    return this;
  }

  range(from: number, to: number) {
    this.remoteBuilder = this.remoteBuilder.range(from, to);
    this.localBuilder.range(from, to);
    return this;
  }

  single() {
    this.remoteBuilder = this.remoteBuilder.single();
    this.localBuilder.single();
    return this;
  }

  maybeSingle() {
    this.remoteBuilder = this.remoteBuilder.maybeSingle();
    this.localBuilder.maybeSingle();
    return this;
  }

  private async executeHybrid(): Promise<{ data: any; error: any; count?: number }> {
    try {
      // Se sabemos que as tabelas na nuvem ainda não foram criadas, responde em 0.1ms direto do banco local
      if (Date.now() < cloudTablesMissingUntil) {
        return await (this.localBuilder as any);
      }
      await maybeSyncLocalToCloudOnce(this.remoteClient);
      if (Date.now() < cloudTablesMissingUntil) {
        return await (this.localBuilder as any);
      }
      const res = await this.remoteBuilder;
      // Se as tabelas ainda não foram criadas no SQL Editor do Supabase (PGRST205 / 42P01),
      // ativa o disjuntor de 60s e usa de forma transparente o banco local.
      if (
        res?.error &&
        (res.error.code === 'PGRST205' ||
          res.error.code === '42P01' ||
          String(res.error.message || '').includes('schema cache'))
      ) {
        cloudTablesMissingUntil = Date.now() + 60_000;
        return await (this.localBuilder as any);
      }
      // Mantém backup local sincronizado em operações de escrita
      if (this.isWriteOp) {
        await (this.localBuilder as any);
      }
      return res;
    } catch {
      return await (this.localBuilder as any);
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.executeHybrid().then(onfulfilled, onrejected);
  }
}

let cloudSeededOnce = false;
let cloudTablesMissingUntil = 0;

async function maybeSyncLocalToCloudOnce(remoteClient: SupabaseClient) {
  if (cloudSeededOnce) return;
  if (Date.now() < cloudTablesMissingUntil) return;
  cloudSeededOnce = true;
  try {
    const { data: existingUsers, error } = await remoteClient
      .from('users')
      .select('id')
      .limit(1);
    if (error) {
      // Tabelas ainda não existem no Supabase Cloud; evita novas tentativas de rede por 60s para zero lag
      cloudSeededOnce = false;
      cloudTablesMissingUntil = Date.now() + 60_000;
      return;
    }
    if (existingUsers && existingUsers.length > 0) {
      return;
    }
    // Se a tabela users existe na nuvem e está vazia, migra os dados locais automaticamente!
    const localStore = loadLocalDb();
    if (localStore.users.length > 0) {
      await remoteClient.from('users').upsert(localStore.users, { onConflict: 'id' });
    }
    if (localStore.study_plans.length > 0) {
      await remoteClient
        .from('study_plans')
        .upsert(localStore.study_plans, { onConflict: 'user_id,file_name' });
    }
    if (localStore.study_records.length > 0) {
      await remoteClient
        .from('study_records')
        .upsert(localStore.study_records, { onConflict: 'plan_id,id' });
    }
    if (localStore.review_records.length > 0) {
      await remoteClient
        .from('review_records')
        .upsert(localStore.review_records, { onConflict: 'plan_id,id' });
    }
    if (localStore.simulado_records.length > 0) {
      await remoteClient
        .from('simulado_records')
        .upsert(localStore.simulado_records, { onConflict: 'plan_id,id' });
    }
    if (localStore.study_cycles.length > 0) {
      await remoteClient
        .from('study_cycles')
        .upsert(localStore.study_cycles, { onConflict: 'user_id,plan_file_name' });
    }
  } catch {
    cloudSeededOnce = false;
  }
}

function getLocalSupabaseAdapter(): SupabaseClient {
  if (!localDbInstance) {
    localDbInstance = {
      from(table: keyof LocalDbStore) {
        return new LocalQueryBuilder(table);
      },
    };
  }
  return localDbInstance as SupabaseClient;
}

let hybridClientInstance: SupabaseClient | null = null;

/**
 * Retorna o cliente administrativo do Supabase exclusivamente no servidor.
 * Conecta ao Supabase Cloud quando configurado e faz fallback transparente para o
 * banco persistente local caso as tabelas SQL ainda não tenham sido criadas no painel,
 * sincronizando tudo automaticamente assim que o schema.sql for executado.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const supabaseServiceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  ).trim();

  if (supabaseUrl.startsWith('http') && supabaseServiceRoleKey) {
    if (!supabaseAdminClient) {
      supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    if (!hybridClientInstance) {
      const remote = supabaseAdminClient;
      hybridClientInstance = {
        from(table: keyof LocalDbStore) {
          return new HybridQueryBuilder(table, remote);
        },
      } as unknown as SupabaseClient;
    }
    return hybridClientInstance;
  }

  return getLocalSupabaseAdapter();
}
