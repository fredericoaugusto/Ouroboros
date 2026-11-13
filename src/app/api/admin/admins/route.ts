import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/auditLogger';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, username, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ admins: data || [] });
  } catch (err) {
    console.error('Erro ao listar admins:', err);
    return NextResponse.json({ error: 'Erro ao listar administradores.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { username, password } = await req.json();
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanUsername || cleanPassword.length < 4) {
      return NextResponse.json(
        { error: 'Usuário e senha (mín. 4 caracteres) são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Já existe um administrador com esse nome.' }, { status: 409 });
    }

    const newId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync(cleanPassword, 10);

    const { error } = await supabase.from('admin_users').insert({
      id: newId,
      username: cleanUsername,
      password_hash: passwordHash,
      is_active: true,
    });

    if (error) throw error;

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_CREATE_ADMIN',
      entityType: 'admin',
      entityId: newId,
      details: { newAdminUsername: cleanUsername },
    });

    return NextResponse.json({ success: true, id: newId }, { status: 201 });
  } catch (err) {
    console.error('Erro ao criar admin:', err);
    return NextResponse.json({ error: 'Erro ao criar administrador.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { adminId, isActive, newPassword } = await req.json();
    if (!adminId) {
      return NextResponse.json({ error: 'adminId é obrigatório.' }, { status: 400 });
    }

    if (adminId === admin.adminId && isActive === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta administrativa.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const patch: Record<string, any> = {};
    if (typeof isActive === 'boolean') patch.is_active = isActive;
    if (newPassword && String(newPassword).trim().length >= 4) {
      patch.password_hash = bcrypt.hashSync(String(newPassword).trim(), 10);
    }

    const { error } = await supabase.from('admin_users').update(patch).eq('id', adminId);
    if (error) throw error;

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_UPDATE_ADMIN',
      entityType: 'admin',
      entityId: adminId,
      details: {
        isActiveUpdated: typeof isActive === 'boolean' ? isActive : undefined,
        passwordReset: Boolean(patch.password_hash),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar admin:', err);
    return NextResponse.json({ error: 'Erro ao atualizar administrador.' }, { status: 500 });
  }
}
