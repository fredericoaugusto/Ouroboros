'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useSidebar } from '../context/SidebarContext';
import { Menu } from 'lucide-react';

const MainContentWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isSidebarExpanded, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const isAuthPage = ['/login', '/register'].includes(pathname);

  if (isAuthPage) {
    return (
      <main className="bg-[#f8fafc] dark:bg-[#0b1320] min-h-[calc(100vh-2rem)] overflow-y-auto">
        {children}
      </main>
    );
  }

  return (
    <main
      className={`transition-all duration-300 ease-in-out ${
        isSidebarExpanded ? 'ml-64' : 'ml-0'
      } relative bg-[#f8fafc] dark:bg-[#0b1320] h-[calc(100vh-2rem)] overflow-y-auto pb-20`}
    >
      {!isSidebarExpanded && (
        <button
          onClick={toggleSidebar}
          className="fixed top-11 left-0 py-2 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-r-xl shadow-md z-40 transition-all duration-200 hover:pr-4"
          title="Abrir Menu"
        >
          <Menu size={18} />
        </button>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </main>
  );
};

export default MainContentWrapper;
