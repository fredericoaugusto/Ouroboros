import { NextResponse } from 'next/server';
import { getAdminSession, getImpersonationState } from '@/lib/adminAuth';

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const impersonation = await getImpersonationState();
  return NextResponse.json({
    authenticated: true,
    admin: { id: admin.adminId, username: admin.username },
    impersonation: impersonation
      ? {
          targetUserId: impersonation.targetUserId,
          targetUsername: impersonation.targetUsername,
          adminId: impersonation.adminId,
          adminUsername: impersonation.adminUsername,
          startedAt: impersonation.startedAt,
        }
      : null,
  });
}
