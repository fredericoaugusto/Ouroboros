import 'server-only';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSupabaseAdmin } from './supabase';

export const ADMIN_COOKIE_NAME = 'ouroboros_admin_session';
export const IMPERSONATE_COOKIE_NAME = 'ouroboros_impersonate';

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas
const IMPERSONATE_TTL_SECONDS = 60 * 60 * 4; // 4 horas

export interface AdminSessionPayload {
  adminId: string;
  username: string;
  exp: number;
}

export interface ImpersonationPayload {
  targetUserId: string;
  targetUsername: string;
  adminId: string;
  adminUsername: string;
  startedAt: string;
  exp: number;
}

export interface EffectiveStudentSession {
  userId: string;
  username: string;
  impersonatedBy: {
    adminId: string;
    adminUsername: string;
    startedAt: string;
  } | null;
}

function getSigningSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET é obrigatório para assinar sessões administrativas.');
  }
  return secret;
}

function signPayload<T extends object>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as T;
    if (!decoded.exp || Date.now() / 1000 > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

let defaultAdminsEnsured = false;

/**
 * Garante a existência dos 2 administradores padrão (byfred e gustavo) na tabela isolada admin_users.
 */
export async function ensureDefaultAdmins(): Promise<void> {
  if (defaultAdminsEnsured) return;

  const supabase = getSupabaseAdmin();
  const defaults = [
    { username: 'byfred', password: 'senha123' },
    { username: 'gustavo', password: 'senha123' },
  ];

  for (const adm of defaults) {
    const { data: existing, error: findErr } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', adm.username)
      .maybeSingle();

    if (findErr) {
      console.error(`Erro ao verificar admin padrão ${adm.username}:`, findErr);
      continue;
    }

    if (!existing) {
      const passwordHash = bcrypt.hashSync(adm.password, 10);
      const { error: insertErr } = await supabase.from('admin_users').insert({
        id: crypto.randomUUID(),
        username: adm.username,
        password_hash: passwordHash,
        is_active: true,
      });
      if (insertErr) {
        console.error(`Erro ao criar admin padrão ${adm.username}:`, insertErr);
      }
    }
  }

  defaultAdminsEnsured = true;
}

export function createAdminSessionToken(adminId: string, username: string): string {
  return signPayload<AdminSessionPayload>({
    adminId,
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
}

export function createImpersonateToken(
  targetUserId: string,
  targetUsername: string,
  adminId: string,
  adminUsername: string
): string {
  return signPayload<ImpersonationPayload>({
    targetUserId,
    targetUsername,
    adminId,
    adminUsername,
    startedAt: new Date().toISOString(),
    exp: Math.floor(Date.now() / 1000) + IMPERSONATE_TTL_SECONDS,
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const payload = verifyToken<AdminSessionPayload>(token);
    if (!payload) return null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, is_active')
      .eq('id', payload.adminId)
      .maybeSingle();

    if (error || !data || !data.is_active) {
      return null;
    }

    return {
      adminId: data.id,
      username: data.username,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function getImpersonationState(): Promise<ImpersonationPayload | null> {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) return null;

    const cookieStore = cookies();
    const token = cookieStore.get(IMPERSONATE_COOKIE_NAME)?.value;
    const payload = verifyToken<ImpersonationPayload>(token);
    if (!payload || payload.adminId !== adminSession.adminId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retorna a sessão efetiva do estudante para todas as operações de estudo.
 * Se um admin estiver em modo impersonation ("assumir usuário"), retorna o usuário alvo
 * com o vínculo auditável do administrador responsável.
 */
export async function getEffectiveStudentSession(): Promise<EffectiveStudentSession | null> {
  const impersonation = await getImpersonationState();
  if (impersonation) {
    return {
      userId: impersonation.targetUserId,
      username: impersonation.targetUsername,
      impersonatedBy: {
        adminId: impersonation.adminId,
        adminUsername: impersonation.adminUsername,
        startedAt: impersonation.startedAt,
      },
    };
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    return null;
  }

  return {
    userId: session.user.id,
    username: session.user.name || session.user.email || session.user.id,
    impersonatedBy: null,
  };
}
