import { NextResponse } from 'next/server';
import {
  IMPERSONATE_COOKIE_NAME,
  createImpersonateToken,
  getAdminSession,
  getImpersonationState,
} from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/auditLogger';

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, username, status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !targetUser) {
      return NextResponse.json({ error: 'Usuário alvo não encontrado.' }, { status: 404 });
    }

    const token = createImpersonateToken(
      targetUser.id,
      targetUser.username,
      admin.adminId,
      admin.username
    );

    await recordAuditLog({
      actorType: 'admin_impersonation',
      actorId: admin.adminId,
      actorUsername: admin.username,
      impersonatedUserId: targetUser.id,
      impersonatedUsername: targetUser.username,
      action: 'ADMIN_IMPERSONATE_START',
      entityType: 'user',
      entityId: targetUser.id,
      details: { targetStatus: targetUser.status },
    });

    const response = NextResponse.json({
      success: true,
      target: { id: targetUser.id, username: targetUser.username },
    });

    response.cookies.set(IMPERSONATE_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      maxAge: 60 * 60 * 4,
    });

    return response;
  } catch (err) {
    console.error('Erro ao iniciar impersonation:', err);
    return NextResponse.json({ error: 'Erro ao assumir usuário.' }, { status: 500 });
  }
}

export async function DELETE() {
  const admin = await getAdminSession();
  const currentImpersonation = await getImpersonationState();

  if (admin && currentImpersonation) {
    await recordAuditLog({
      actorType: 'admin_impersonation',
      actorId: admin.adminId,
      actorUsername: admin.username,
      impersonatedUserId: currentImpersonation.targetUserId,
      impersonatedUsername: currentImpersonation.targetUsername,
      action: 'ADMIN_IMPERSONATE_STOP',
      entityType: 'user',
      entityId: currentImpersonation.targetUserId,
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(IMPERSONATE_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
