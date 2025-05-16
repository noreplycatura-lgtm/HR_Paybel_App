
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
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <AppSidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 print:sm:pl-0"> {/* Removed sm:pl-14 */}
          <TopNavbar />
          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 print:p-0 print:m-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { state } = useSidebar(); // Get sidebar state
  return (
    <Sidebar collapsible="icon" className="print:hidden"> {/* Add print:hidden here */}
      <SidebarHeader className="flex items-center justify-between p-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"> {/* Updated href */}
            {state === 'expanded' && (
               <Image 
                src="https://placehold.co/120x40.png?text=Novita"
                alt={`${COMPANY_NAME} Logo`}
                width={120}
                height={40}
                data-ai-hint="company logo"
              />
            )}
            {state === 'collapsed' && (
              <Image 
                src="https://placehold.co/32x32.png?text=N"
                alt={`${COMPANY_NAME} Icon`}
                width={32}
                height={32}
                data-ai-hint="icon healthcare"
              />
            )}
          </Link>
        {state === 'expanded' && <SidebarTrigger asChild>
          <Button variant="ghost" size="icon">
            <PanelLeft className="h-5 w-5" />
          </Button>
        </SidebarTrigger>}
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarNav items={NAV_ITEMS} />
      </SidebarContent>
      {/* <SidebarFooter className="p-2">
        {state === 'expanded' && <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {COMPANY_NAME}</p>}
      </SidebarFooter> */}
    </Sidebar>
  );
}
