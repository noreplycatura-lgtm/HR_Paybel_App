
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { PanelLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopNavbar } from "@/components/layout/top-navbar";
import { NAV_ITEMS, COMPANY_NAME } from "@/lib/constants";

const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthCheckComplete, setIsAuthCheckComplete] = React.useState(false);

  React.useEffect(() => {
    let userIsLoggedIn = false;
    if (typeof window !== 'undefined') {
      userIsLoggedIn = localStorage.getItem(LOGGED_IN_STATUS_KEY) === 'true';
      if (!userIsLoggedIn) {
        router.replace('/login');
      }
    }
    // Crucially, set auth check as complete *after* the check and potential redirect.
    setIsAuthCheckComplete(true);
  }, [router]);

  // If the authentication check hasn't completed yet, render nothing to avoid flicker.
  if (!isAuthCheckComplete) {
    return null;
  }

  // After the auth check is complete, if the user is determined to not be logged in
  // (which means the redirect to /login is in progress or should have happened),
  // render nothing. This prevents a flash of dashboard content.
  if (typeof window !== 'undefined' && localStorage.getItem(LOGGED_IN_STATUS_KEY) !== 'true') {
      return null;
  }

  // If auth check is complete and user is logged in, render the layout.
  return (
    <SidebarProvider defaultOpen={false}>
       <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className="flex flex-1 flex-col sm:gap-4 sm:py-4">
          <TopNavbar />
          <main className="flex-1 overflow-y-auto p-4 sm:px-6 sm:py-0 md:gap-8 print:p-0 print:m-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { state: sidebarContextState } = useSidebar();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const renderState = isClient ? sidebarContextState : "collapsed";

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader className="flex items-center justify-between p-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            {renderState === 'expanded' && (
               <Image
                src="https://placehold.co/120x40.png?text=Novita"
                alt={`${COMPANY_NAME} Logo`}
                width={120}
                height={40}
                data-ai-hint="company logo"
              />
            )}
            {renderState === 'collapsed' && (
              <Image
                src="https://placehold.co/32x32.png?text=N"
                alt={`${COMPANY_NAME} Icon`}
                width={32}
                height={32}
                data-ai-hint="icon healthcare"
              />
            )}
          </Link>
        {renderState === 'expanded' && <SidebarTrigger asChild>
          <Button variant="ghost" size="icon">
            <PanelLeft className="h-5 w-5" />
          </Button>
        </SidebarTrigger>}
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarNav items={NAV_ITEMS} />
      </SidebarContent>
    </Sidebar>
  );
}
