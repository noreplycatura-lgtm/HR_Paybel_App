"use client";

import * as React from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopNavbar } from "@/components/layout/top-navbar";
import { NAV_ITEMS, APP_NAME } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { getCompanyConfig, type CompanyConfig } from "@/lib/google-sheets";

const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: APP_NAME
  });

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        if (config) {
          setCompanyConfig({
            company_logo: config.company_logo || '',
            company_name: config.company_name || APP_NAME
          });
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      }
    }
    fetchConfig();
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const loggedIn = localStorage.getItem(LOGGED_IN_STATUS_KEY);
      if (loggedIn === 'true') {
        setIsAuthenticated(true);
      } else {
        router.replace('/login');
      }
    }
    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar 
        collapsible="icon" 
        variant="sidebar"
        className="border-r-0"
      >
        <div className="flex h-full flex-col bg-slate-800">
          {/* Header */}
          <SidebarHeader className="p-4 border-b border-slate-700">
            <Link href="/dashboard" className="flex items-center gap-3">
              {companyConfig.company_logo ? (
                <img
                  src={companyConfig.company_logo}
                  alt="Logo"
                  className="h-10 w-10 rounded-lg object-contain bg-white p-1 flex-shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
              )}
              <div className="group-data-[collapsible=icon]:hidden">
                <h1 className="text-base font-bold text-white truncate">
                  {companyConfig.company_name || APP_NAME}
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Payroll System
                </p>
              </div>
            </Link>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="flex-1 p-3 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider group-data-[collapsible=icon]:hidden">
              Main Menu
            </p>
            <SidebarNav items={NAV_ITEMS} />
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-4 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 text-center group-data-[collapsible=icon]:hidden">
              © 2024 Novita Healthcare
            </p>
          </SidebarFooter>
        </div>
      </Sidebar>

      <SidebarInset className="bg-gray-50">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}