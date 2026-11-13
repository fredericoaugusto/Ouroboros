-- ============================================================================
-- Ouroboros - Schema PostgreSQL para Supabase
-- Segurança: RLS habilitado sem políticas públicas (acesso exclusivo via
-- service_role no backend Next.js, com escopo estrito por user_id).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Função auxiliar para atualizar updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. Usuários (substitui data/users.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Planos de Estudo (substitui data/<userId>/<plano>.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  name TEXT NOT NULL,
  observations TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  edital TEXT NOT NULL DEFAULT '',
  icon_url TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  banca_topic_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, file_name)
);

CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON public.study_plans(user_id);

DROP TRIGGER IF EXISTS trg_study_plans_updated_at ON public.study_plans;
CREATE TRIGGER trg_study_plans_updated_at
  BEFORE UPDATE ON public.study_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Registros de Estudo (Sessões)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_records (
  id TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  subject_id TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  study_time INTEGER NOT NULL DEFAULT 0,
  questions JSONB NOT NULL DEFAULT '{"correct": 0, "total": 0}'::jsonb,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  review_periods JSONB,
  teoria_finalizada BOOLEAN NOT NULL DEFAULT FALSE,
  count_in_planning BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, id)
);

CREATE INDEX IF NOT EXISTS idx_study_records_user_plan ON public.study_records(user_id, plan_id);

DROP TRIGGER IF EXISTS trg_study_records_updated_at ON public.study_records;
CREATE TRIGGER trg_study_records_updated_at
  BEFORE UPDATE ON public.study_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Registros de Revisão
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_records (
  id TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  study_record_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  original_date TEXT NOT NULL,
  subject_id TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  review_period TEXT NOT NULL DEFAULT '',
  completed_date TEXT,
  ignored BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, id)
);

CREATE INDEX IF NOT EXISTS idx_review_records_user_plan ON public.review_records(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_review_records_study_record ON public.review_records(plan_id, study_record_id);

DROP TRIGGER IF EXISTS trg_review_records_updated_at ON public.review_records;
CREATE TRIGGER trg_review_records_updated_at
  BEFORE UPDATE ON public.review_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Registros de Simulados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulado_records (
  id TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT '',
  banca TEXT NOT NULL DEFAULT '',
  time_spent TEXT NOT NULL DEFAULT '',
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, id)
);

CREATE INDEX IF NOT EXISTS idx_simulado_records_user_plan ON public.simulado_records(user_id, plan_id);

DROP TRIGGER IF EXISTS trg_simulado_records_updated_at ON public.simulado_records;
CREATE TRIGGER trg_simulado_records_updated_at
  BEFORE UPDATE ON public.simulado_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Ciclos de Estudo (substitui data/<userId>/<plano>.cycle.json)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_file_name TEXT NOT NULL,
  study_cycle JSONB,
  study_hours TEXT NOT NULL DEFAULT '',
  weekly_questions_goal TEXT NOT NULL DEFAULT '',
  current_progress_minutes INTEGER NOT NULL DEFAULT 0,
  session_progress_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminder_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  study_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plan_file_name)
);

CREATE INDEX IF NOT EXISTS idx_study_cycles_user_id ON public.study_cycles(user_id);

DROP TRIGGER IF EXISTS trg_study_cycles_updated_at ON public.study_cycles;
CREATE TRIGGER trg_study_cycles_updated_at
  BEFORE UPDATE ON public.study_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) - Default Deny para clientes públicos/anon
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_cycles ENABLE ROW LEVEL SECURITY;
