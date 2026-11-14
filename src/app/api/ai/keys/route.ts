import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getUserMaskedAiKeysStatus, saveUserEncryptedAiKeys } from '@/lib/userAiKeys';

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const status = await getUserMaskedAiKeysStatus(String(userId));
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao consultar status das chaves.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await req.json();
    const { deepseekKey, geminiKey, groqKey } = body || {};

    await saveUserEncryptedAiKeys(String(userId), {
      deepseekKey,
      geminiKey,
      groqKey,
    });

    const status = await getUserMaskedAiKeysStatus(String(userId));
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao salvar chave criptografada no banco.' },
      { status: 500 }
    );
  }
}
