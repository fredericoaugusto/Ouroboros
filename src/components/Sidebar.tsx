'use client';

import React, { useState } from 'react';
import { useSidebar } from '../context/SidebarContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggleButton from './ThemeToggleButton';
import PlanSelector from './PlanSelector';
import ImportEditalModal from './ImportEditalModal';
import { useTheme } from '../context/ThemeContext';
import { useSession, signOut } from 'next-auth/react';
import { 
  Home, 
  Layers, 
  BookOpen, 
  FileText, 
  Calendar, 
  History, 
  RotateCcw, 
  BarChart3, 
  Trophy, 
  Database, 
  LogOut, 
  Menu, 
  Sparkles, 
  X,
  Compass
} from 'lucide-react';

const Sidebar = () => {
  const { isSidebarExpanded, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { data: session } = useSession();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  if (['/login', '/register'].includes(pathname)) {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Planos', href: '/planos', icon: Layers },
    { label: 'Disciplinas', href: '/materias', icon: BookOpen },
    { label: 'Edital Verticalizado', href: '/edital', icon: FileText },
    { label: 'Planejamento', href: '/planejamento', icon: Calendar },
    { label: 'Histórico', href: '/historico', icon: History },
    { label: 'Revisões', href: '/revisoes', icon: RotateCcw },
    { label: 'Estatísticas', href: '/estatisticas', icon: BarChart3 },
    { label: 'Simulados', href: '/simulados', icon: Trophy },
    { label: 'Backup', href: '/backup', icon: Database },
  ];

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 transform ${
          isSidebarExpanded ? 'translate-x-0' : '-translate-x-full'
        } bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-200 w-64 border-r border-slate-200 dark:border-[#1a293e] transition-transform duration-300 ease-in-out z-50 flex flex-col shadow-xl`}
      >
        {/* Cabeçalho da Sidebar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1a293e]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black text-base">
              O
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white block leading-tight">
                Ouroboros
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                Estudos 2.0
              </span>
            </div>
          </Link>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#131f33] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Botão de Destaque: Importar Edital com IA */}
        <div className="p-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 hover:from-emerald-500/25 hover:to-indigo-500/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-all shadow-sm group"
          >
            <Sparkles size={15} className="group-hover:rotate-12 transition-transform text-emerald-500" />
            Importar Edital via IA
          </button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-grow px-3 py-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border-l-2 border-emerald-500 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#131f33] hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Plano Atual, Tema e Logout */}
        <div className="p-3 border-t border-slate-100 dark:border-[#1a293e] space-y-2 bg-slate-50/50 dark:bg-[#090e17]/40">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggleButton />
            <div className="flex-grow min-w-0">
              <PlanSelector />
            </div>
          </div>

          {session && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut size={14} />
              Sair ({session.user?.name || 'Usuário'})
            </button>
          )}
        </div>
      </aside>

      {/* Modal de Importação com IA */}
      <ImportEditalModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
