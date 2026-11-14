import 'server-only';
import crypto from 'crypto';
import { getEffectiveStudentSession } from './adminAuth';

export interface ExtensionTokenPayload {
  userId: string;
  username: string;
  scope: 'krono_extension_v1';
  exp: number;
}

const EXTENSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias

function getExtensionSigningSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'krono-extension-fallback-secret-2026'
  );
}

export function createExtensionToken(userId: string, username: string): string {
  const payload: ExtensionTokenPayload = {
    userId,
    username,
    scope: 'krono_extension_v1',
    exp: Math.floor(Date.now() / 1000) + EXTENSION_TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getExtensionSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `krono_ext_${encoded}.${sig}`;
}

export function verifyExtensionToken(rawToken: string | null | undefined): ExtensionTokenPayload | null {
  if (!rawToken) return null;
  const trimmed = rawToken.trim().replace(/^Bearer\s+/i, '');
  if (!trimmed.startsWith('krono_ext_')) return null;

  const body = trimmed.slice('krono_ext_'.length);
  const dotIndex = body.indexOf('.');
  if (dotIndex === -1) return null;

  const encoded = body.slice(0, dotIndex);
  const sig = body.slice(dotIndex + 1);
  if (!encoded || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getExtensionSigningSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as ExtensionTokenPayload;
    if (decoded.scope !== 'krono_extension_v1') return null;
    if (!decoded.exp || Date.now() / 1000 > decoded.exp) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Resolve o usuário autenticado seja via Token da Extensão (Header Authorization / x-krono-ext-token)
 * ou via sessão ativa de cookies na aba do navegador.
 */
export async function resolveExtensionUser(req: Request): Promise<{ userId: string; username: string } | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('x-krono-ext-token');
  const tokenPayload = verifyExtensionToken(authHeader);
  if (tokenPayload) {
    return { userId: tokenPayload.userId, username: tokenPayload.username };
  }

  try {
    const session = await getEffectiveStudentSession();
    if (session?.userId) {
      return { userId: session.userId, username: session.username };
    }
  } catch {
    // ignore cookie errors on cross-origin requests
  }
  return null;
}
