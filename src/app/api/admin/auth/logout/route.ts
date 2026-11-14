import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  IMPERSONATE_COOKIE_NAME,
  getAdminSession,
} from '@/lib/adminAuth';
import { recordAuditLog } from '@/lib/auditLogger';

export async function POST() {
  const admin = await getAdminSession();
  if (admin) {
    await recordAuditLog({
      actorType: 'admin',
      actorId: admin.adminId,
      actorUsername: admin.username,
      action: 'ADMIN_LOGOUT',
      entityType: 'session',
      entityId: admin.adminId,
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set(IMPERSONATE_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
