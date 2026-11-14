import 'server-only';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getDerivedEncryptionKey(): Buffer {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'krono-default-server-encryption-secret-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Criptografa uma chave de API em repouso usando AES-256-GCM autenticado.
 * Formato salvo no banco: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptApiKey(plainText: string): string {
  const clean = plainText.trim();
  if (!clean) return '';
  const key = getDerivedEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descriptografa uma chave de API exclusivamente na memória do servidor.
 */
export function decryptApiKey(payload?: string | null): string | null {
  if (!payload || typeof payload !== 'string') return null;
  if (!payload.startsWith('enc:v1:')) {
    return null;
  }
  try {
    const parts = payload.split(':');
    if (parts.length !== 5) return null;
    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const key = getDerivedEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Falha ao descriptografar chave de API do usuário:', err);
    return null;
  }
}

/**
 * Retorna apenas uma máscara visual segura (ex: "sk-••••••1234") para exibir no frontend
 * sem jamais enviar a chave real para o navegador.
 */
export function maskApiKey(plainKey?: string | null): string | null {
  if (!plainKey || plainKey.length < 8) return null;
  const prefix = plainKey.slice(0, 3);
  const suffix = plainKey.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}
