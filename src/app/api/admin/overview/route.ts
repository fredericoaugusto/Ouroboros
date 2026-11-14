import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [
      usersRes,
      plansRes,
      recordsRes,
      simuladosRes,
      logsRes,
      adminsRes,
    ] = await Promise.all([
      supabase.from('users').select('id, status'),
      supabase.from('study_plans').select('id', { count: 'exact', head: true }),
      supabase.from('study_records').select('study_time'),
      supabase.from('simulado_records').select('id', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      supabase.from('admin_users').select('id', { count: 'exact', head: true }),
    ]);

    const users = usersRes.data || [];
    const totalMinutes = (recordsRes.data || []).reduce(
      (acc, r: any) => acc + (Number(r.study_time) || 0),
      0
    );

    return NextResponse.json({
      users: {
        total: users.length,
        pending: users.filter((u: any) => u.status === 'pending').length,
        approved: users.filter((u: any) => u.status === 'approved').length,
        suspended: users.filter((u: any) => u.status === 'suspended' || u.status === 'rejected').length,
      },
      plans: plansRes.count || 0,
      studyRecords: (recordsRes.data || []).length,
      totalStudyHours: Math.round((totalMinutes / 60) * 10) / 10,
      simulados: simuladosRes.count || 0,
      auditLogs: logsRes.count || 0,
      admins: adminsRes.count || 0,
    });
  } catch (err) {
    console.error('Erro ao carregar overview admin:', err);
    return NextResponse.json({ error: 'Erro ao carregar estatísticas.' }, { status: 500 });
  }
}
