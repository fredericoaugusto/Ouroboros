import 'server-only';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from './supabase';
import type { EffectiveStudentSession } from './adminAuth';

export type AuditActorType = 'user' | 'admin' | 'admin_impersonation' | 'system';

export interface AuditLogInput {
  actorType: AuditActorType;
  actorId: string;
  actorUsername: string;
  impersonatedUserId?: string | null;
  impersonatedUsername?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function getRequestMetadata(): { ipAddress: string | null; userAgent: string | null } {
  try {
    const h = headers();
    const forwardedFor = h.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : h.get('x-real-ip');
    const userAgent = h.get('user-agent');
    return { ipAddress: ipAddress || null, userAgent: userAgent || null };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

export async function recordAuditLog(entry: AuditLogInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const meta = getRequestMetadata();

    const { error } = await supabase.from('audit_logs').insert({
      actor_type: entry.actorType,
      actor_id: entry.actorId,
      actor_username: entry.actorUsername,
      impersonated_user_id: entry.impersonatedUserId ?? null,
      impersonated_username: entry.impersonatedUsername ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {},
      ip_address: entry.ipAddress !== undefined ? entry.ipAddress : meta.ipAddress,
      user_agent: entry.userAgent !== undefined ? entry.userAgent : meta.userAgent,
    });

    if (error) {
      console.error('Erro ao gravar audit_log:', error);
    }
  } catch (err) {
    console.error('Falha inesperada no auditLogger:', err);
  }
}

export async function recordStudentAudit(
  session: EffectiveStudentSession,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>
): Promise<void> {
  if (session.impersonatedBy) {
    await recordAuditLog({
      actorType: 'admin_impersonation',
      actorId: session.impersonatedBy.adminId,
      actorUsername: session.impersonatedBy.adminUsername,
      impersonatedUserId: session.userId,
      impersonatedUsername: session.username,
      action,
      entityType,
      entityId,
      details,
    });
  } else {
    await recordAuditLog({
      actorType: 'user',
      actorId: session.userId,
      actorUsername: session.username,
      action,
      entityType,
      entityId,
      details,
    });
  }
}
