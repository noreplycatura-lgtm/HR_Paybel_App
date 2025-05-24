
"use client";

import Link from "next/link";
import { UserCircle, PanelLeft, LogOut } from "lucide-react"; 
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
import { useToast } from "@/hooks/use-toast"; 

const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";
const LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY = "novita_current_logged_in_user_display_name_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";


interface ActivityLogEntry {
  timestamp: string;
  message: string;
  user: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];

    const loggedInUser = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY) || "System";

    activities.unshift({ timestamp: new Date().toISOString(), message, user: loggedInUser });
    activities = activities.slice(0, 10);
    localStorage.setItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error("Error adding to activity log from top-navbar:", error);
  }
};


export function TopNavbar() {
  const { toggleSidebar, isMobile } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGGED_IN_STATUS_KEY);
      localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_DISPLAY_NAME_KEY);
    }
    addActivityLog('User logged out.');
    router.replace('/login');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
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
            >
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
