'use client';

import React, { useEffect } from 'react';
import GlobalFooterTimer from './GlobalFooterTimer';
import StudyRegisterModal from './StudyRegisterModal';
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  BarElement,
} from 'chart.js';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import DonationModal from './DonationModal';
import { useDonationModal } from '../context/DonationModalContext';
import { useData } from '../context/DataContext';

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isModalOpen, closeModal } = useDonationModal();
  const {
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    setIsStopwatchModalOpen,
    initialStudyRecord,
    setInitialStudyRecord,
    addStudyRecord,
    updateStudyRecord,
  } = useData();

  useEffect(() => {
    Chart.register(
      ArcElement,
      Tooltip,
      Legend,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      BarElement
    );
  }, []);

  // Fecha automaticamente overlays full-page ao mudar de rota
  useEffect(() => {
    setIsRegisterModalOpen(false);
    setIsStopwatchModalOpen(false);
  }, [pathname, setIsRegisterModalOpen, setIsStopwatchModalOpen]);

  useEffect(() => {
    const publicPaths = ['/login', '/register'];
    if (status === 'unauthenticated' && !publicPaths.includes(pathname)) {
      router.push('/login');
    }
    if (status === 'authenticated' && publicPaths.includes(pathname)) {
      router.push('/dashboard');
    }
  }, [status, router, pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b1320]">
        <div className="flex items-center gap-3 text-emerald-500">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Carregando Krono...
          </p>
        </div>
      </div>
    );
  }

  const isAuthPage = ['/login', '/register'].includes(pathname);

  if (status === 'authenticated' || isAuthPage) {
    return (
      <>
        <div
          key={pathname}
          className={
            isAuthPage
              ? 'animate-fadeIn'
              : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn'
          }
        >
          {children}
        </div>
        {isRegisterModalOpen && (
          <StudyRegisterModal
            isOpen={isRegisterModalOpen}
            onClose={() => {
              setIsRegisterModalOpen(false);
              setInitialStudyRecord(null);
            }}
            initialRecord={initialStudyRecord}
            onSave={(record) => {
              if (record.id) {
                updateStudyRecord(record);
              } else {
                addStudyRecord(record);
              }
              setIsRegisterModalOpen(false);
              setInitialStudyRecord(null);
            }}
          />
        )}
        <GlobalFooterTimer />
        <DonationModal isOpen={isModalOpen} onClose={closeModal} />
      </>
    );
  }

  return null;
}
