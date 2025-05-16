
"use client";

import Link from "next/link";
import { UserCircle, LogOut, PanelLeft, Edit3, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import { useSidebar } from "@/components/ui/sidebar";
import { useEditorAuth } from "@/hooks/useEditorAuth"; // Import the hook

export function TopNavbar() {
  const { toggleSidebar, isMobile } = useSidebar();
  const { isEditor, logoutEditor, isLoadingAuth } = useEditorAuth();
  const router = useRouter();

  const handleLogout = () => {
    logoutEditor();
    router.push('/dashboard'); // Navigate to dashboard after logout
    router.refresh(); // Refresh to ensure state is updated across components
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 print:hidden">
       {isMobile && (
         <Button size="icon" variant="outline" onClick={toggleSidebar} className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
       )}
      
      <div className="flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
           <Image 
            src="https://placehold.co/40x40.png?text=N" 
            alt={`${COMPANY_NAME} Mini Logo`}
            width={32}
            height={32}
            className="h-8 w-8"
            data-ai-hint="logo healthcare"
          />
          <span className="text-lg font-semibold hidden md:block">{APP_NAME}</span>
        </Link>
      </div>
      
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full"
              disabled={isLoadingAuth}
            >
              {isLoadingAuth ? <PanelLeft className="h-5 w-5 animate-pulse" /> : isEditor ? <ShieldCheck className="h-6 w-6 text-primary" /> : <UserCircle className="h-6 w-6" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isLoadingAuth ? (
              <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
            ) : isEditor ? (
              <>
                <DropdownMenuLabel className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary"/> Editor Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout Editor
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>Guest Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/login">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Login as Editor
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
