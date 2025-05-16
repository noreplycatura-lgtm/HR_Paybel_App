
"use client"; 

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { PanelLeft } from "lucide-react";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      {/* Main content area wrapper, sibling to AppSidebar */}
      <div className="flex flex-1 flex-col sm:gap-4 sm:py-4">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-4 sm:px-6 sm:py-0 md:gap-8 print:p-0 print:m-0">
          {children}
        </main>
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

  // For SSR and initial client render, use a state consistent with defaultOpen={false} ("collapsed").
  // After client mounts (isClient is true), use the actual context state.
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
      {/* <SidebarFooter className="p-2">
        {renderState === 'expanded' && <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {COMPANY_NAME}</p>}
      </SidebarFooter> */}
    </Sidebar>
  );
}

