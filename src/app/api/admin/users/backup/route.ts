import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/auditLogger';
import {
  getFullPlanData,
  mapRowToCycleData,
  normalizePlanFileName,
  upsertFullPlanData,
} from '@/lib/studyPlansRepo';

export async function GET(req: Request) {
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
      return NextResponse.json({ error: 'Estudante não encontrado.' }, { status: 404 });
    }

    const [plansRes, cyclesRes] = await Promise.all([
      supabase.from('study_plans').select('file_name').eq('user_id', userId),
      supabase.from('study_cycles').select('*').eq('user_id', userId),
    ]);

    const allPlansData = [];
    for (const row of plansRes.data || []) {
      const planContent = await getFullPlanData(userId, row.file_name);
      if (planContent) {
        allPlansData.push({ fileName: row.file_name, content: planContent });
      }
    }

    const allCyclesData = (cyclesRes.data || []).map((row: any) => ({
      fileName: row.plan_file_name.replace(/\.json$/, '.cycle.json'),
      content: mapRowToCycleData(row),
    }));

    const firstPlanFile = allPlansData[0]?.fileName || '';
    const backup = {
      plans: allPlansData,
      cycles: allCyclesData,
      clientData: {
        version: 3,
        selectedDataFile: firstPlanFile,
        studyCycle: allCyclesData[0]?.content?.studyCycle || null,
        sessionProgressMap: allCyclesData[0]?.content?.sessionProgressMap || {},
        completedCycles: 0,
        currentProgressMinutes: allCyclesData[0]?.content?.currentProgressMinutes || 0,
        studyHours: allCyclesData[0]?.content?.studyHours || '',
        weeklyQuestionsGoal: allCyclesData[0]?.content?.weeklyQuestionsGoal || '',
        studyDays: allCyclesData[0]?.content?.studyDays || [],
        reminderNotes: allCyclesData[0]?.content?.reminderNotes || [],
      },
    };

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_EXPORT_USER_BACKUP',
      entityType: 'backup',
      entityId: userId,
      details: {
        targetUsername: targetUser.username,
        plansCount: allPlansData.length,
        cyclesCount: allCyclesData.length,
      },
    });

    return NextResponse.json({ username: targetUser.username, backup });
  } catch (err) {
    console.error('Erro ao exportar backup do estudante no admin:', err);
    return NextResponse.json({ error: 'Erro ao exportar backup.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { userId, backupData } = await req.json();
    if (!userId || !backupData || !Array.isArray(backupData.plans)) {
      return NextResponse.json(
        { error: 'userId e backupData válido (com lista de planos) são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'Estudante não encontrado.' }, { status: 404 });
    }

    await Promise.all([
      supabase.from('study_plans').delete().eq('user_id', userId),
      supabase.from('study_cycles').delete().eq('user_id', userId),
    ]);

    for (const plan of backupData.plans) {
      if (plan?.fileName && plan?.content) {
        await upsertFullPlanData(userId, plan.fileName, plan.content);
      }
    }

    if (Array.isArray(backupData.cycles)) {
      for (const cycle of backupData.cycles) {
        if (cycle?.fileName && cycle?.content) {
          const normalizedPlan = normalizePlanFileName(cycle.fileName);
          await supabase.from('study_cycles').upsert(
            {
              user_id: userId,
              plan_file_name: normalizedPlan,
              study_cycle: cycle.content.studyCycle ?? null,
              study_hours: cycle.content.studyHours || '',
              weekly_questions_goal: cycle.content.weeklyQuestionsGoal || '',
              current_progress_minutes: cycle.content.currentProgressMinutes || 0,
              session_progress_map: cycle.content.sessionProgressMap || {},
              reminder_notes: cycle.content.reminderNotes || [],
              study_days: cycle.content.studyDays || [],
            },
            { onConflict: 'user_id,plan_file_name' }
          );
        }
      }
    }

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_RESTORE_USER_BACKUP',
      entityType: 'backup',
      entityId: userId,
      details: {
        targetUsername: targetUser.username,
        plansRestored: backupData.plans.length,
        cyclesRestored: backupData.cycles?.length ?? 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao restaurar backup do estudante no admin:', err);
    return NextResponse.json({ error: 'Erro ao restaurar backup.' }, { status: 500 });
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
      return NextResponse.json({ error: 'Estudante não encontrado.' }, { status: 404 });
    }

    await Promise.all([
      supabase.from('study_plans').delete().eq('user_id', userId),
      supabase.from('study_cycles').delete().eq('user_id', userId),
    ]);

    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_CLEAR_USER_DATA',
      entityType: 'user',
      entityId: userId,
      details: { targetUsername: targetUser.username },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao zerar dados do estudante no admin:', err);
    return NextResponse.json({ error: 'Erro ao zerar dados.' }, { status: 500 });
  }
}
