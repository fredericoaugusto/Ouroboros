'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  BookOpen,
  ScrollText,
  UserCog,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
  UserCheck,
  KeyRound,
  LogOut,
  RefreshCw,
  Search,
  Clock,
  Activity,
  Plus,
  AlertTriangle,
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'plans' | 'logs' | 'admins';

interface AdminUserInfo {
  id: string;
  username: string;
}

interface OverviewStats {
  users: { total: number; pending: number; approved: number; suspended: number };
  plans: number;
  studyRecords: number;
  totalStudyHours: number;
  simulados: number;
  auditLogs: number;
  admins: number;
}

interface StudentRow {
  id: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  plansCount: number;
  recordsCount: number;
  studyHours: number;
}

interface PlanRow {
  id: string;
  userId: string;
  username: string;
  fileName: string;
  name: string;
  cargo: string;
  edital: string;
  subjectsCount: number;
  recordsCount: number;
  updatedAt: string;
}

interface AuditLogRow {
  id: string;
  actor_type: 'user' | 'admin' | 'admin_impersonation' | 'system';
  actor_id: string;
  actor_username: string;
  impersonated_user_id?: string | null;
  impersonated_username?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}

interface AdminAccountRow {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUserInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountRow[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Filtros
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [logActorFilter, setLogActorFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  // Novo admin
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [ovRes, uRes, pRes, lRes, aRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/users'),
        fetch('/api/admin/plans'),
        fetch(`/api/admin/logs?actorType=${encodeURIComponent(logActorFilter)}&search=${encodeURIComponent(logSearch)}`),
        fetch('/api/admin/admins'),
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (uRes.ok) {
        const d = await uRes.json();
        setStudents(d.users || []);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPlans(d.plans || []);
      }
      if (lRes.ok) {
        const d = await lRes.json();
        setLogs(d.logs || []);
      }
      if (aRes.ok) {
        const d = await aRes.json();
        setAdminAccounts(d.admins || []);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
      showToast('error', 'Erro ao carregar dados do painel administrativo.');
    } finally {
      setLoadingData(false);
    }
  }, [logActorFilter, logSearch]);

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (!res.ok) {
          router.replace('/admin/login');
          return;
        }
        const data = await res.json();
        setAdmin(data.admin);
        setCheckingAuth(false);
      } catch {
        router.replace('/admin/login');
      }
    };
    verify();
  }, [router]);

  useEffect(() => {
    if (!checkingAuth && admin) {
      loadAllData();
    }
  }, [checkingAuth, admin, loadAllData]);

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  };

  const handleUpdateUserStatus = async (
    userId: string,
    status: 'approved' | 'rejected' | 'suspended' | 'pending'
  ) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao atualizar status.');
      return;
    }
    showToast('success', `Status atualizado para "${status}".`);
    loadAllData();
  };

  const handleResetStudentPassword = async (userId: string, username: string) => {
    const pwd = window.prompt(`Digite a nova senha para o estudante "${username}" (mín. 4 caracteres):`);
    if (!pwd) return;
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword: pwd }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao redefinir senha.');
      return;
    }
    showToast('success', `Senha de "${username}" redefinida com sucesso.`);
    loadAllData();
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente "${username}" e todos os seus planos?`)) {
      return;
    }
    const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao excluir conta.');
      return;
    }
    showToast('success', `Conta "${username}" excluída.`);
    loadAllData();
  };

  const handleImpersonate = async (userId: string, username: string) => {
    if (
      !window.confirm(
        `Deseja assumir a conta do estudante "${username}"?\n\nTodas as ações executadas ficarão registradas nos logs de auditoria com seu usuário admin.`
      )
    ) {
      return;
    }

    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao assumir usuário.');
      return;
    }
    window.location.href = '/dashboard';
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!window.confirm(`Excluir o plano "${planName}" permanentemente?`)) return;
    const res = await fetch(`/api/admin/plans?planId=${encodeURIComponent(planId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao excluir plano.');
      return;
    }
    showToast('success', `Plano "${planName}" removido.`);
    loadAllData();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newAdminUsername, password: newAdminPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao criar admin.');
      return;
    }
    setNewAdminUsername('');
    setNewAdminPassword('');
    showToast('success', 'Novo administrador criado com sucesso.');
    loadAllData();
  };

  const handleToggleAdminActive = async (adminId: string, currentActive: boolean) => {
    const res = await fetch('/api/admin/admins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, isActive: !currentActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Falha ao atualizar admin.');
      return;
    }
    showToast('success', 'Status do administrador atualizado.');
    loadAllData();
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b1320] text-slate-300 flex items-center justify-center text-sm">
        Verificando credenciais administrativas...
      </div>
    );
  }

  const filteredStudents = students.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(userSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (userFilter === 'all') return true;
    if (userFilter === 'suspended') return u.status === 'suspended' || u.status === 'rejected';
    return u.status === userFilter;
  });

  const pendingStudents = students.filter((u) => u.status === 'pending');

  const statusBadge = (status: StudentRow['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            Aprovado
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
            Pendente
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
            Recusado
          </span>
        );
      case 'suspended':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
            Suspenso
          </span>
        );
    }
  };

  const actorBadge = (type: AuditLogRow['actor_type']) => {
    switch (type) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            ADMIN
          </span>
        );
      case 'admin_impersonation':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            IMPERSONATION
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            ESTUDANTE
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1320] text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-[#1f304a] bg-[#101a2c] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Ouroboros • Painel Administrativo
              </h1>
              <p className="text-[11px] text-slate-400">
                Logado como admin <strong className="text-indigo-400">{admin?.username}</strong> (conta isolada)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={loadingData}
              className="px-3 py-1.5 rounded-lg bg-[#16233a] hover:bg-[#1e2f4d] border border-[#243757] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
            {
              id: 'users',
              label: `Estudantes (${students.length})`,
              badge: pendingStudents.length > 0 ? pendingStudents.length : undefined,
              icon: Users,
            },
            { id: 'plans', label: `Planos (${plans.length})`, icon: BookOpen },
            { id: 'logs', label: 'Logs de Auditoria', icon: ScrollText },
            { id: 'admins', label: `Admins (${adminAccounts.length})`, icon: UserCog },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a]">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Estudantes Cadastrados</span>
                  <Users className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{overview.users.total}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {overview.users.approved} aprovados • {overview.users.pending} pendentes
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a]">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Planos & Simulados</span>
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{overview.plans}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {overview.simulados} simulados registrados
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a]">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Volume de Estudos</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{overview.totalStudyHours}h</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {overview.studyRecords} sessões registradas
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a]">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Auditoria & Segurança</span>
                  <Activity className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{overview.auditLogs}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {overview.admins} administradores ativos
                </div>
              </div>
            </div>

            {/* Fila rápida de aprovações pendentes */}
            <div className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a]">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                Cadastros Aguardando Aprovação ({pendingStudents.length})
              </h2>
              {pendingStudents.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum cadastro pendente no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingStudents.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0d1626] border border-[#1f304a]"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{u.username}</div>
                        <div className="text-[11px] text-slate-400">
                          Cadastrado em {new Date(u.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateUserStatus(u.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                        </button>
                        <button
                          onClick={() => handleUpdateUserStatus(u.id, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 font-bold text-xs flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Recusar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'pending', label: `Pendentes (${pendingStudents.length})` },
                  { id: 'approved', label: 'Aprovados' },
                  { id: 'suspended', label: 'Suspensos/Recusados' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setUserFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      userFilter === f.id
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-[#131f33] text-slate-300 border-[#1f304a] hover:bg-[#1a2942]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar estudante..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131f33] border border-[#1f304a] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-[#131f33] border border-[#1f304a] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f192b] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Estudante</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Planos / Sessões</th>
                    <th className="px-4 py-3">Aprovação</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f304a]">
                  {filteredStudents.map((u) => (
                    <tr key={u.id} className="hover:bg-[#16233a]/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{u.username}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{u.id}</div>
                      </td>
                      <td className="px-4 py-3">{statusBadge(u.status)}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {u.plansCount} planos • {u.recordsCount} sessões ({u.studyHours}h)
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {u.approved_by ? `Por ${u.approved_by}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {u.status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, 'approved')}
                              title="Aprovar"
                              className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold"
                            >
                              Aprovar
                            </button>
                          )}
                          {u.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, 'rejected')}
                              title="Recusar"
                              className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-semibold"
                            >
                              Recusar
                            </button>
                          )}
                          {u.status === 'approved' && (
                            <button
                              onClick={() => handleUpdateUserStatus(u.id, 'suspended')}
                              title="Suspender"
                              className="px-2 py-1 rounded bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 font-semibold inline-flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" /> Suspender
                            </button>
                          )}
                          <button
                            onClick={() => handleImpersonate(u.id, u.username)}
                            title="Assumir conta (Impersonation auditável)"
                            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/25 font-semibold inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" /> Assumir
                          </button>
                          <button
                            onClick={() => handleResetStudentPassword(u.id, u.username)}
                            title="Redefinir senha"
                            className="p-1.5 rounded bg-[#1a2942] hover:bg-[#233759] text-slate-300"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            title="Excluir conta"
                            className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nenhum estudante encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: PLANS */}
        {activeTab === 'plans' && (
          <div className="rounded-2xl bg-[#131f33] border border-[#1f304a] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f192b] text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Estudante</th>
                  <th className="px-4 py-3">Cargo / Edital</th>
                  <th className="px-4 py-3">Conteúdo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f304a]">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-[#16233a]/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{p.name || p.fileName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.fileName}</div>
                    </td>
                    <td className="px-4 py-3 text-indigo-300 font-semibold">{p.username}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.cargo || '—'} {p.edital ? `• ${p.edital}` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.subjectsCount} matérias • {p.recordsCount} sessões
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeletePlan(p.id, p.name || p.fileName)}
                        className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum plano cadastrado na plataforma.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Todos os Logs' },
                  { id: 'user', label: 'Estudantes' },
                  { id: 'admin', label: 'Admins' },
                  { id: 'admin_impersonation', label: 'Impersonation' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setLogActorFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      logActorFilter === f.id
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-[#131f33] text-slate-300 border-[#1f304a] hover:bg-[#1a2942]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por usuário, ação ou entidade..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131f33] border border-[#1f304a] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-[#131f33] border border-[#1f304a] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f192b] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Data/Hora</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Ator</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Alvo / Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f304a]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#16233a]/50 align-top">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">{actorBadge(log.actor_type)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{log.actor_username}</div>
                        {log.impersonated_username && (
                          <div className="text-[11px] text-amber-400">
                            ↳ assumiu: <strong>{log.impersonated_username}</strong>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-300">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {log.entity_type && (
                          <span className="text-[11px] text-slate-400">
                            [{log.entity_type}: {log.entity_id || '—'}]
                          </span>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-1 text-[10px] text-slate-400 bg-[#0b1320] p-1.5 rounded border border-[#1f304a] max-w-md overflow-x-auto">
                            {JSON.stringify(log.details)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Nenhum log registrado para os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ADMINS */}
        {activeTab === 'admins' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-[#131f33] border border-[#1f304a] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f192b] text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Administrador</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Criado em</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f304a]">
                  {adminAccounts.map((adm) => (
                    <tr key={adm.id} className="hover:bg-[#16233a]/50">
                      <td className="px-4 py-3 font-bold text-white">{adm.username}</td>
                      <td className="px-4 py-3">
                        {adm.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(adm.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleAdminActive(adm.id, adm.is_active)}
                          disabled={adm.id === admin?.id}
                          className="px-2.5 py-1 rounded bg-[#1a2942] hover:bg-[#233759] text-slate-200 font-semibold disabled:opacity-40"
                        >
                          {adm.is_active ? 'Desativar' : 'Reativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleCreateAdmin}
              className="p-5 rounded-2xl bg-[#131f33] border border-[#1f304a] space-y-4 h-fit"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Novo Administrador Isolado
              </h3>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Usuário Admin</label>
                <input
                  type="text"
                  required
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b1320] border border-[#1f304a] text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="ex: admin_suporte"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b1320] border border-[#1f304a] text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Mínimo 4 caracteres"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors"
              >
                Criar Administrador
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
