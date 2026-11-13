'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../context/SidebarContext';
import { Menu } from 'lucide-react';

const MainContentWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isSidebarExpanded, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const isAuthPage = ['/login', '/register'].includes(pathname) || pathname.startsWith('/admin');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (isAuthPage) {
    return (
      <main className="bg-[#f8fafc] dark:bg-[#0b1320] min-h-screen overflow-y-auto animate-fadeIn">
        {children}
      </main>
    );
  }

  return (
    <main
      className={`transition-all duration-300 ease-in-out ${
        isSidebarExpanded ? 'lg:ml-64' : 'ml-0'
      } relative bg-[#f8fafc] dark:bg-[#0b1320] h-screen overflow-y-auto pb-24`}
    >
      {/* Top Route Transition Progress & Spinner */}
      {isTransitioning && (
        <>
          <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 z-50 animate-pulse" />
          <div className="fixed top-4 right-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 dark:bg-[#131f33]/95 backdrop-blur-md border border-slate-200 dark:border-[#1f304a] shadow-md pointer-events-none animate-fadeIn">
            <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Carregando...
            </span>
          </div>
        </>
      )}

      {!isSidebarExpanded && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-0 py-2 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-r-xl shadow-md z-40 transition-all duration-200 hover:pr-4"
          title="Abrir Menu"
        >
          <Menu size={18} />
        </button>
      )}
      {children}
    </main>
  );
};

export default MainContentWrapper;
