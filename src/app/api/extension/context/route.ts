import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createExtensionToken, resolveExtensionUser } from '@/lib/extensionAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-krono-ext-token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function flattenTopicsList(topics: any[], acc: string[] = []): string[] {
  if (!Array.isArray(topics)) return acc;
  for (const t of topics) {
    if (t?.topic_text && !t.is_grouping_topic) {
      acc.push(t.topic_text);
    } else if (t?.topic_text && (!Array.isArray(t.sub_topics) || t.sub_topics.length === 0)) {
      acc.push(t.topic_text);
    }
    if (Array.isArray(t?.sub_topics) && t.sub_topics.length > 0) {
      flattenTopicsList(t.sub_topics, acc);
    }
  }
  return acc;
}

export async function GET(req: Request) {
  try {
    const user = await resolveExtensionUser(req);
    if (!user) {
      return NextResponse.json(
        { connected: false, error: 'Não autenticado no Krono.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: plansRows, error } = await supabase
      .from('study_plans')
      .select('file_name, name, subjects')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const plans = (plansRows || []).map((row: any) => {
      const rawSubjects = Array.isArray(row.subjects) ? row.subjects : [];
      return {
        fileName: row.file_name,
        name: row.name || row.file_name.replace(/\.json$/i, ''),
        subjects: rawSubjects.map((s: any) => ({
          id: s.id || s.subject,
          subject: s.subject,
          color: s.color || '#10B981',
          topics: flattenTopicsList(s.topics || []),
        })),
      };
    });

    const pairingToken = createExtensionToken(user.userId, user.username);

    return NextResponse.json(
      {
        connected: true,
        userId: user.userId,
        username: user.username,
        pairingToken,
        plans,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('Erro em /api/extension/context:', err);
    return NextResponse.json(
      { connected: false, error: err?.message || 'Erro interno no servidor.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
