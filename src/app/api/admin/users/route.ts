import { NextResponse } from 'next/server';
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
    const [usersRes, plansRes, recordsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, username, status, approved_by, approved_at, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('study_plans').select('id, user_id'),
      supabase.from('study_records').select('user_id, study_time'),
    ]);

    if (usersRes.error) throw usersRes.error;

    const plansByUser = new Map<string, number>();
    for (const p of plansRes.data || []) {
      plansByUser.set(p.user_id, (plansByUser.get(p.user_id) || 0) + 1);
    }

    const statsByUser = new Map<string, { records: number; minutes: number }>();
    for (const r of recordsRes.data || []) {
      const cur = statsByUser.get(r.user_id) || { records: 0, minutes: 0 };
      cur.records += 1;
      cur.minutes += Number(r.study_time) || 0;
      statsByUser.set(r.user_id, cur);
    }

    const enriched = (usersRes.data || []).map((u: any) => {
      const st = statsByUser.get(u.id) || { records: 0, minutes: 0 };
      return {
        ...u,
        plansCount: plansByUser.get(u.id) || 0,
        recordsCount: st.records,
        studyHours: Math.round((st.minutes / 60) * 10) / 10,
      };
    });

    return NextResponse.json({ users: enriched });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    return NextResponse.json({ error: 'Erro ao listar usuários.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { userId, status, newPassword } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: targetUser, error: findErr } = await supabase
      .from('users')
      .select('id, username, status')
      .eq('id', userId)
      .maybeSingle();

    if (findErr || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const patch: Record<string, any> = {};
    let auditAction = 'ADMIN_UPDATE_USER';

    if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      patch.status = status;
      if (status === 'approved') {
        patch.approved_by = admin.username;
        patch.approved_at = new Date().toISOString();
        auditAction = 'ADMIN_APPROVE_USER';
      } else if (status === 'rejected') {
        auditAction = 'ADMIN_REJECT_USER';
      } else if (status === 'suspended') {
        auditAction = 'ADMIN_SUSPEND_USER';
      }
    }

    if (newPassword && String(newPassword).trim().length >= 4) {
      patch.password_hash = bcrypt.hashSync(String(newPassword).trim(), 10);
      auditAction = 'ADMIN_RESET_USER_PASSWORD';
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nenhuma alteração válida informada.' }, { status: 400 });
    }

    const { error: updateErr } = await supabase.from('users').update(patch).eq('id', userId);
    if (updateErr) throw updateErr;

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: auditAction,
      entityType: 'user',
      entityId: userId,
      details: {
        targetUsername: targetUser.username,
        previousStatus: targetUser.status,
        newStatus: patch.status ?? targetUser.status,
        passwordReset: Boolean(patch.password_hash),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_DELETE_USER',
      entityType: 'user',
      entityId: userId,
      details: { targetUsername: targetUser.username },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 });
  }
}
