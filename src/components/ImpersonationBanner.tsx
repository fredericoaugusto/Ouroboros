'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const impersonatedBy = (session as any)?.impersonatedBy as
    | { adminId: string; adminUsername: string; startedAt: string }
    | undefined;

  if (!impersonatedBy || pathname.startsWith('/admin')) {
    return null;
  }

  const handleExitImpersonation = async () => {
    setExiting(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
      router.push('/admin');
      router.refresh();
    } catch (err) {
      console.error('Erro ao encerrar modo auditoria:', err);
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-slate-950 px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          MODO AUDITORIA ATIVO: operando como{' '}
          <strong className="underline">{session?.user?.name}</strong> (Admin responsável:{' '}
          <strong>{impersonatedBy.adminUsername}</strong>). Todas as ações estão sendo registradas.
        </span>
      </div>
      <button
        onClick={handleExitImpersonation}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 text-amber-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
      >
        <LogOut className="w-3.5 h-3.5" />
        {exiting ? 'Encerrando...' : 'Sair da conta e voltar ao Admin'}
      </button>
    </div>
  );
}
