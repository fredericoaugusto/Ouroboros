import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getUserDecryptedAiKeys } from '@/lib/userAiKeys';

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      systemPrompt,
      userPrompt,
      imageBase64,
      imageMimeType = 'image/jpeg',
      temperature = 0.2,
      jsonMode = false,
    } = body;

    if (!userPrompt) {
      return NextResponse.json(
        { error: 'O texto de entrada (userPrompt) é obrigatório.' },
        { status: 400 }
      );
    }

    // Busca e descriptografa em memória apenas as chaves da conta deste usuário
    const userKeys = await getUserDecryptedAiKeys(String(userId));
    const deepseekKey = userKeys.deepseekKey;
    const geminiKey = userKeys.geminiKey;
    const groqKey = userKeys.groqKey;

    // 1. Se houver imagem (ex: Foto de Redação Manuscrita) e GEMINI_API_KEY estiver configurada
    if (imageBase64 && geminiKey) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt
            ? { parts: [{ text: systemPrompt }] }
            : undefined,
          contents: [
            {
              role: 'user',
              parts: [
                { text: userPrompt },
                {
                  inlineData: {
                    mimeType: imageMimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data?.error?.message || 'Erro ao processar imagem no Gemini.' },
          { status: res.status }
        );
      }
      const content =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      return NextResponse.json({ content, provider: 'gemini-vision-free' });
    }

    // 2. Tenta DeepSeek com a chave criptografada do usuário
    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const content = data?.choices?.[0]?.message?.content || '';
        return NextResponse.json({ content, provider: 'deepseek' });
      }

      if (response.status === 402 && !geminiKey && !groqKey) {
        return NextResponse.json(
          {
            error:
              'A sua chave da API DeepSeek está sem saldo (US$ 0.00). Cadastre uma chave com saldo no botão "🔑 Configurar Minha Chave de IA" ou adicione uma chave gratuita do Google Gemini.',
          },
          { status: 402 }
        );
      }

      if (!geminiKey && !groqKey) {
        return NextResponse.json(
          {
            error:
              data?.error?.message ||
              `Erro na API DeepSeek (status ${response.status}). Verifique sua chave em "🔑 Configurar Minha Chave de IA".`,
          },
          { status: response.status }
        );
      }
    }

    // 3. Fallback ou Provedor Gratuito: Google Gemini API
    if (geminiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemPrompt
            ? { parts: [{ text: systemPrompt }] }
            : undefined,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data?.error?.message || 'Erro na API do Google Gemini.' },
          { status: res.status }
        );
      }
      const content =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      return NextResponse.json({ content, provider: 'gemini-free' });
    }

    // 4. Fallback ou Provedor Gratuito: Groq Cloud API
    if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data?.error?.message || 'Erro na API da Groq.' },
          { status: res.status }
        );
      }
      const content = data?.choices?.[0]?.message?.content || '';
      return NextResponse.json({ content, provider: 'groq-free' });
    }

    return NextResponse.json(
      {
        error:
          'Você ainda não cadastrou sua Chave de API. Clique no botão "🔑 Configurar Minha Chave de IA" para salvar sua chave criptografada no banco.',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Erro na rota /api/ai/deepseek:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao processar requisição com IA.' },
      { status: 500 }
    );
  }
}
