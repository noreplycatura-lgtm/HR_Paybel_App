
"use client";

import Link from "next/link";
import { UserCircle, PanelLeft } from "lucide-react";
import Image from "next/image";

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

export function TopNavbar() {
  const { toggleSidebar, isMobile } = useSidebar();

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
            >
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            {/* Login/Logout options removed as login is disabled */}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
