import type { Metadata } from "next";

import { SidebarProvider } from "../context/SidebarContext";
import { DataProvider } from "../context/DataContext";
import { ThemeProvider } from "../context/ThemeContext";
import { NotificationProvider } from "../context/NotificationContext";
import Sidebar from "../components/Sidebar";
import MainContentWrapper from "../components/MainContentWrapper";
import ClientLayoutWrapper from "@/components/ClientLayoutWrapper";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alexandria • Estudos & Alta Performance",
  description: "Plataforma inteligente de gestão de estudos, editais e revisões adaptativas",
  icons: {
    icon: '/icon.svg?v=2',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className="antialiased bg-[#f8fafc] dark:bg-[#0b1320]"
      >
        <Providers>
          <SidebarProvider>
            <NotificationProvider>
              <ThemeProvider>
                <DataProvider>
                  <Sidebar />
                  <MainContentWrapper>
                    <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
                  </MainContentWrapper>
                </DataProvider>
              </ThemeProvider>
            </NotificationProvider>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
