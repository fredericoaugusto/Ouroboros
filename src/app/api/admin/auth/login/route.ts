import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  ensureDefaultAdmins,
} from '@/lib/adminAuth';
import { recordAuditLog } from '@/lib/auditLogger';

export async function POST(req: Request) {
  try {
    await ensureDefaultAdmins();

    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha administrativos são obrigatórios.' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    const supabase = getSupabaseAdmin();

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash, is_active')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar admin:', error);
      return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      await recordAuditLog({
        actorType: 'admin',
        actorId: admin?.id || 'unknown',
        actorUsername: cleanUsername,
        action: 'ADMIN_LOGIN_FAILED',
        entityType: 'session',
      });
      return NextResponse.json({ error: 'Credenciais administrativas inválidas.' }, { status: 401 });
    }

    if (!admin.is_active) {
      return NextResponse.json({ error: 'Conta administrativa desativada.' }, { status: 403 });
    }

    const token = createAdminSessionToken(admin.id, admin.username);
    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.id,
      actorUsername: admin.username,
      action: 'ADMIN_LOGIN',
      entityType: 'session',
      entityId: admin.id,
    });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, username: admin.username },
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (err) {
    console.error('Erro no login admin:', err);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
