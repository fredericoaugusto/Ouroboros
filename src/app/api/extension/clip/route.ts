import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveExtensionUser } from '@/lib/extensionAuth';
import { normalizePlanFileName } from '@/lib/studyPlansRepo';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-krono-ext-token',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const user = await resolveExtensionUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token da extensão inválido ou sessão expirada.' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = await req.json();
    const {
      planFile,
      subjectName,
      topicName,
      htmlSnippet,
    }: {
      planFile?: string;
      subjectName?: string;
      topicName?: string;
      htmlSnippet?: string;
    } = body || {};

    if (!htmlSnippet || typeof htmlSnippet !== 'string' || !htmlSnippet.trim()) {
      return NextResponse.json(
        { success: false, error: 'Conteúdo do recorte/nota vazio.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: plansRows, error: fetchErr } = await supabase
      .from('study_plans')
      .select('id, file_name, name, subjects')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!plansRows || plansRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum plano de estudo encontrado na sua conta.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const normalizedRequestedPlan = planFile ? normalizePlanFileName(planFile) : '';
    let targetPlan =
      plansRows.find(
        (p: any) =>
          p.file_name.toLowerCase() === normalizedRequestedPlan ||
          (p.name || '').toLowerCase() === (planFile || '').toLowerCase()
      ) || plansRows[0];

    const subjects: any[] = Array.isArray(targetPlan.subjects) ? [...targetPlan.subjects] : [];
    if (subjects.length === 0) {
      return NextResponse.json(
        { success: false, error: 'O plano selecionado não possui disciplinas cadastradas.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanSub = (subjectName || '').trim().toLowerCase();
    let targetSubject =
      subjects.find(
        (s: any) =>
          (s.id || '').toLowerCase() === cleanSub ||
          (s.subject || '').trim().toLowerCase() === cleanSub
      ) || subjects[0];

    const cleanTopic = (topicName || '').trim().toLowerCase();
    let updatedTopicText = '';
    let updatedNotes = '';

    const appendRecursive = (topics: any[]): boolean => {
      for (let i = 0; i < topics.length; i++) {
        const tText = (topics[i].topic_text || '').trim();
        if (cleanTopic && tText.toLowerCase() === cleanTopic) {
          const currentNotes = topics[i].notes || '';
          topics[i] = {
            ...topics[i],
            notes: currentNotes ? `${currentNotes}\n${htmlSnippet}` : htmlSnippet,
          };
          updatedTopicText = tText;
          updatedNotes = topics[i].notes;
          return true;
        }
        if (Array.isArray(topics[i].sub_topics) && appendRecursive(topics[i].sub_topics)) {
          return true;
        }
      }
      return false;
    };

    let matched = appendRecursive(targetSubject.topics || []);

    // Fallback: partial match on topic_text if exact match wasn't found
    if (!matched && cleanTopic) {
      const appendPartialRecursive = (topics: any[]): boolean => {
        for (let i = 0; i < topics.length; i++) {
          const tText = (topics[i].topic_text || '').trim();
          if (
            tText.toLowerCase().includes(cleanTopic) ||
            cleanTopic.includes(tText.toLowerCase())
          ) {
            const currentNotes = topics[i].notes || '';
            topics[i] = {
              ...topics[i],
              notes: currentNotes ? `${currentNotes}\n${htmlSnippet}` : htmlSnippet,
            };
            updatedTopicText = tText;
            updatedNotes = topics[i].notes;
            return true;
          }
          if (Array.isArray(topics[i].sub_topics) && appendPartialRecursive(topics[i].sub_topics)) {
            return true;
          }
        }
        return false;
      };
      matched = appendPartialRecursive(targetSubject.topics || []);
    }

    // Fallback to first leaf topic in the subject if no topic was specified
    if (!matched && Array.isArray(targetSubject.topics) && targetSubject.topics.length > 0) {
      const firstTopic = targetSubject.topics[0];
      const currentNotes = firstTopic.notes || '';
      firstTopic.notes = currentNotes ? `${currentNotes}\n${htmlSnippet}` : htmlSnippet;
      updatedTopicText = firstTopic.topic_text;
      updatedNotes = firstTopic.notes;
      matched = true;
    }

    if (!matched) {
      return NextResponse.json(
        { success: false, error: 'Nenhum tópico encontrado na disciplina para salvar a nota.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const { error: updateErr } = await supabase
      .from('study_plans')
      .update({ subjects })
      .eq('id', targetPlan.id)
      .eq('user_id', user.userId);

    if (updateErr) throw updateErr;

    return NextResponse.json(
      {
        success: true,
        planFile: targetPlan.file_name,
        subjectName: targetSubject.subject,
        topicName: updatedTopicText,
        updatedNotes,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('Erro em /api/extension/clip:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro interno ao salvar recorte nas notas.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
