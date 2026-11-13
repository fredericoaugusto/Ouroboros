import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const actorType = searchParams.get('actorType');
    const action = searchParams.get('action');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number(searchParams.get('limit') || 150), 500);

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actorType && actorType !== 'all') {
      query = query.eq('actor_type', actorType);
    }
    if (action && action !== 'all') {
      query = query.eq('action', action);
    }
    if (search) {
      query = query.or(
        `actor_username.ilike.%${search}%,impersonated_username.ilike.%${search}%,action.ilike.%${search}%,entity_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    console.error('Erro ao consultar audit_logs:', err);
    return NextResponse.json({ error: 'Erro ao consultar logs.' }, { status: 500 });
  }
}
