import 'server-only';
import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase';

export interface User {
  id: string;
  username: string;
  password: string; // Hashed password
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, password_hash')
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
  };
}

export async function createUser(username: string, hashedPassword: string): Promise<User> {
  const supabase = getSupabaseAdmin();
  const newId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: newId,
      username,
      password_hash: hashedPassword,
    })
    .select('id, username, password_hash')
    .single();

  if (error || !data) {
    console.error('Erro ao criar usuário no Supabase:', error);
    throw new Error('Falha ao registrar usuário no banco de dados.');
  }

  return {
    id: data.id,
    username: data.username,
    password: data.password_hash,
  };
}
