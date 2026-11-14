import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase';

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface User {
  id: string;
  username: string;
  password: string; // Hashed password
  status: UserStatus;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, password_hash, status')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar usuário no Supabase:', error);
    throw new Error('Falha ao consultar usuário no banco de dados.');
  }

  if (!data) {
    return undefined;
  }

  return {
    id: data.id,
    username: data.username,
    password: data.password_hash,
    status: (data.status as UserStatus) || 'pending',
  };
}

export async function createUser(username: string, hashedPassword: string): Promise<User> {
  const supabase = getSupabaseAdmin();
  const newId = crypto.randomUUID();

  // Se ainda não houver nenhum administrador cadastrado, aprova automaticamente o usuário
  // para que ele possa logar imediatamente sem ficar bloqueado.
  const { count: adminCount } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true });
  const initialStatus: UserStatus = (adminCount ?? 0) > 0 ? 'pending' : 'approved';

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: newId,
      username,
      password_hash: hashedPassword,
      status: initialStatus,
    })
    .select('id, username, password_hash, status')
    .single();

  if (error || !data) {
    console.error('Erro ao criar usuário no Supabase:', error);
    throw new Error('Falha ao registrar usuário no banco de dados.');
  }

  return {
    id: data.id,
    username: data.username,
    password: data.password_hash,
    status: (data.status as UserStatus) || 'pending',
  };
}
