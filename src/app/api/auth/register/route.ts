import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByUsername } from '../../../../lib/users';
import { recordAuditLog } from '@/lib/auditLogger';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const cleanUsername = String(username).trim();
    const existingUser = await getUserByUsername(cleanUsername);
    if (existingUser) {
      return NextResponse.json({ message: 'Este nome de usuário já está em uso.' }, { status: 409 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const created = await createUser(cleanUsername, hashedPassword);

    await recordAuditLog({
      actorType: 'user',
      actorId: created.id,
      actorUsername: created.username,
      action: 'USER_REGISTER',
      entityType: 'user',
      entityId: created.id,
      details: { status: 'pending' },
    });

    const isPending = created.status === 'pending';

    return NextResponse.json(
      {
        message: isPending
          ? 'Cadastro realizado! Sua conta está pendente de aprovação por um administrador.'
          : 'Cadastro realizado com sucesso! Você já pode fazer login.',
        pendingApproval: isPending,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}
