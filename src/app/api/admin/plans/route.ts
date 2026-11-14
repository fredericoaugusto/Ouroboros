import { NextResponse } from 'next/server';
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
    const [plansRes, usersRes, recordsRes] = await Promise.all([
      supabase
        .from('study_plans')
        .select('id, user_id, file_name, name, cargo, edital, subjects, created_at, updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('users').select('id, username'),
      supabase.from('study_records').select('plan_id'),
    ]);

    if (plansRes.error) throw plansRes.error;

    const userMap = new Map<string, string>();
    for (const u of usersRes.data || []) {
      userMap.set(u.id, u.username);
    }

    const recordsByPlan = new Map<string, number>();
    for (const r of recordsRes.data || []) {
      recordsByPlan.set(r.plan_id, (recordsByPlan.get(r.plan_id) || 0) + 1);
    }

    const plans = (plansRes.data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      username: userMap.get(p.user_id) || 'Desconhecido',
      fileName: p.file_name,
      name: p.name,
      cargo: p.cargo,
      edital: p.edital,
      subjectsCount: Array.isArray(p.subjects) ? p.subjects.length : 0,
      recordsCount: recordsByPlan.get(p.id) || 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({ plans });
  } catch (err) {
    console.error('Erro ao listar planos no admin:', err);
    return NextResponse.json({ error: 'Erro ao listar planos.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    if (!planId) {
      return NextResponse.json({ error: 'planId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: plan } = await supabase
      .from('study_plans')
      .select('id, user_id, file_name, name')
      .eq('id', planId)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });
    }

    const { error } = await supabase.from('study_plans').delete().eq('id', planId);
    if (error) throw error;

    await supabase
      .from('study_cycles')
      .delete()
      .eq('user_id', plan.user_id)
      .eq('plan_file_name', plan.file_name);

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_DELETE_PLAN',
      entityType: 'plan',
      entityId: plan.id,
      details: {
        fileName: plan.file_name,
        planName: plan.name,
        ownerUserId: plan.user_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir plano no admin:', err);
    return NextResponse.json({ error: 'Erro ao excluir plano.' }, { status: 500 });
  }
}
