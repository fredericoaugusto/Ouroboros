# 🚀 Migração para Supabase (Server-Side), Backup/Restore Resiliente e Painel Administrativo com Auditoria Completa

Este Pull Request substitui a persistência local em arquivos `.json` por banco de dados relacional gerenciado (**Supabase / PostgreSQL**) com isolamento **100% server-side**, mantém a compatibilidade total com backup/restore `.json` para recuperação de desastres e introduz um **Painel Administrativo isolado** com fila de aprovação de cadastros, logs de auditoria completos e modo *impersonation* ("assumir usuário") 100% rastreável.

---

## 📋 Resumo das Implementações

### 1. Migração Completa de `.json` para Supabase (Zero Exposição no Frontend)
- **Schema PostgreSQL (`supabase/schema.sql`)**:
  - `public.users`: Contas de estudantes (`id`, `username`, `password_hash`, `status`, `approved_by`, `approved_at`).
  - `public.study_plans`: Planos de estudo (`file_name`, `name`, `cargo`, `edital`, `icon_url`, árvore recursiva `subjects JSONB` e `banca_topic_weights JSONB`).
  - `public.study_records`, `public.review_records`, `public.simulado_records`: Tabelas normalizadas com `PRIMARY KEY (plan_id, id)` e `ON DELETE CASCADE`, permitindo `UPSERT`/`DELETE` granulares sem reescrever o plano inteiro.
  - `public.study_cycles`: Ciclos semanais, metas de horas/questões, progresso e notas de lembrete.
- **Segurança em Camadas**:
  - Credenciais exclusivamente no servidor via `.env` (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`), **sem prefixo `NEXT_PUBLIC_`**.
  - Módulo `src/lib/supabase.ts` protegido com `import 'server-only'` (qualquer importação acidental em Client Component falha o build).
  - **Row Level Security (RLS)** habilitado em todas as tabelas em modo *default-deny* para `anon` e `authenticated`.
  - Todas as Server Actions (`src/app/actions.tsx`) e API Routes (`src/app/api/import-guide/route.ts`) filtram estritamente pelo `user_id` autenticado na sessão.
- **Documentação para Configuração**:
  - Adicionados `.env.example` e `SUPABASE_SETUP.md` com guia passo a passo para configuração inicial.

### 2. Rotina de Backup e Restore `.json` 100% Funcional (Disaster Recovery)
- **Exportação (`exportFullBackupAction`)**: Gera o arquivo `.json` completo diretamente do Supabase (todos os planos, editais, matérias, pesos, sessões de estudo, revisões, simulados, ciclos e `clientData`).
- **Restauração (`restoreFullBackupAction` + `src/lib/studyPlansRepo.ts`)**:
  - Valida o `.json` antes de limpar a conta atual.
  - Gera fallback de `id` (`crypto.randomUUID()`) caso um backup legado não possua IDs.
  - Deduplica registros e realiza `UPSERT` em lotes de 500 linhas para suportar históricos extensos sem erros de payload ou conflito.
  - Restaura ciclos legados a partir de `clientData` caso o array `cycles` não esteja presente em backups antigos.

### 3. Sistema de Aprovação de Novos Cadastros
- Novos registros em `/register` (`POST /api/auth/register`) são criados com `status = 'pending'`.
- O login de estudantes (`src/app/api/auth/[...nextauth]/route.ts`) bloqueia contas `pending`, `rejected` ou `suspended` exibindo mensagem clara ao usuário e registrando a tentativa nos logs.
- Apenas contas aprovadas (`status = 'approved'`) por um administrador têm acesso à plataforma.

### 4. Painel Administrativo Totalmente Isolado (`/admin` e `/admin/login`)
- **Tabela e Sessão Independentes**: Administradores residem em `public.admin_users` (totalmente separada de `public.users`), usando cookie próprio `HttpOnly` assinado com HMAC-SHA256 (`ouroboros_admin_session`) e nunca se misturam com contas de estudantes.
- **Administradores Padrão**: Seed automático garantido para `byfred` e `gustavo` (senha inicial padrão: `senha123`).
- **Gestão Completa (`/admin`)**:
  - **Visão Geral**: Métricas globais da plataforma (estudantes, pendentes, planos, simulados, horas estudadas, volume de logs) e fila rápida de aprovação.
  - **Estudantes & Aprovações**: Criar estudante já aprovado, aprovar, recusar, suspender, redefinir senha, excluir conta, exportar/restaurar backup `.json` direto da conta do estudante, zerar dados e assumir conta.
  - **Planos**: Visualização e moderação de planos de toda a plataforma.
  - **Administradores**: Criação de novos admins e ativação/desativação de contas administrativas.

### 5. Auditoria Completa (`public.audit_logs`) e Impersonation Rastreável
- **Logs Unificados**: Registra ações de estudantes (`USER_REGISTER`, `USER_LOGIN`, `USER_LOGIN_BLOCKED`, `PLAN_CREATE`, `PLAN_DELETE`, `STUDY_RECORD_SAVE`, `STUDY_RECORD_DELETE`, `REVIEW_RECORD_SAVE`, `SIMULADO_RECORD_SAVE`, `SIMULADO_RECORD_DELETE`, `CYCLE_SAVE`, `BACKUP_EXPORT`, `BACKUP_RESTORE`, `DATA_CLEAR_ALL`, `GUIDE_IMPORT`) e ações administrativas (`ADMIN_LOGIN`, `ADMIN_LOGOUT`, `ADMIN_APPROVE_USER`, `ADMIN_REJECT_USER`, `ADMIN_SUSPEND_USER`, `ADMIN_DELETE_USER`, `ADMIN_CREATE_ADMIN`, `ADMIN_UPDATE_ADMIN`, `ADMIN_DELETE_PLAN`).
- **Impersonation ("Assumir Usuário") 100% Auditável**:
  - O administrador pode assumir a conta de qualquer estudante pelo botão **Assumir** no `/admin` (`POST /api/admin/impersonate`).
  - Requer dupla validação no servidor (cookie admin válido + cookie de impersonation assinado).
  - Grava `ADMIN_IMPERSONATE_START` e `ADMIN_IMPERSONATE_STOP`, e toda ação realizada enquanto assume a conta é gravada com `actor_type = 'admin_impersonation'`, identificando tanto o admin responsável quanto o estudante alvo.
  - Exibe banner fixo (`ImpersonationBanner`) no topo da aplicação com botão para encerrar a auditoria e retornar ao painel `/admin`.

---

## 🛠️ Arquivos Principais Adicionados/Modificados
- `supabase/schema.sql`, `.env.example`, `SUPABASE_SETUP.md`, `AGENTS.md`
- `src/lib/supabase.ts`, `src/lib/studyPlansRepo.ts`, `src/lib/users.ts`, `src/lib/adminAuth.ts`, `src/lib/auditLogger.ts`
- `src/app/actions.tsx`, `src/app/api/import-guide/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/admin/**` (auth, overview, users, plans, logs, admins, impersonate)
- `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx`, `src/components/ImpersonationBanner.tsx`
- `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/components/Sidebar.tsx`, `src/components/MainContentWrapper.tsx`, `src/app/layout.tsx`

---

## ✅ Checklist Pós-Deploy
1. Executar `supabase/schema.sql` no SQL Editor do Supabase.
2. Configurar `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (ou Docker).
3. Rodar `npm install` e `npm run build` (ou `docker compose up -d --build`).
4. Acessar `/admin/login` com `byfred` ou `gustavo` (`senha123`) e alterar as senhas padrão em produção.
