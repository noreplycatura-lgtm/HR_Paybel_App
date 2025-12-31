"use client";

import Link from "next/link";
import { UserCircle, PanelLeft, LogOut, CloudUpload, CloudDownload, Loader2 } from "lucide-react"; 
import Image from "next/image";
import { useRouter } from "next/navigation"; 
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME } from "@/lib/constants";
import { useSidebar } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast"; 
import { uploadToCloud, downloadFromCloud } from "@/lib/sync-helper";
import { getCompanyConfig, type CompanyConfig } from "@/lib/google-sheets";

const LOGGED_IN_STATUS_KEY = "novita_logged_in_status_v1";
const LOCAL_STORAGE_RECENT_ACTIVITIES_KEY = "novita_recent_activities_v1";

interface ActivityLogEntry {
  timestamp: string;
  message: string;
}

const addActivityLog = (message: string) => {
  if (typeof window === 'undefined') return;
  try {
    const storedActivities = localStorage.getItem(LOCAL_STORAGE_RECENT_ACTIVITIES_KEY);
    let activities: ActivityLogEntry[] = storedActivities ? JSON.parse(storedActivities) : [];
    if (!Array.isArray(activities)) activities = [];

    activities.unshift({ timestamp: new Date().toISOString(), message });
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
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: APP_NAME
  });

  // Fetch company config on mount
  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        setCompanyConfig(config);
      } catch (error) {
        console.error('Error fetching company config:', error);
      }
    }
    fetchConfig();
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGGED_IN_STATUS_KEY);
    }
    addActivityLog('User logged out.');
    router.replace('/login');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const success = await uploadToCloud();
      if (success) {
        toast({ title: "Upload Success", description: "Data cloud me save ho gaya!" });
        addActivityLog('Data uploaded to cloud.');
      } else {
        toast({ title: "Upload Failed", description: "Data upload nahi ho paya.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Kuch gadbad ho gayi.", variant: "destructive" });
    }
    setIsUploading(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const success = await downloadFromCloud();
      if (success) {
        toast({ title: "Download Success", description: "Data cloud se load ho gaya! Page refresh ho raha hai..." });
        addActivityLog('Data downloaded from cloud.');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast({ title: "Download Failed", description: "Cloud me koi data nahi hai ya download fail ho gaya.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Kuch gadbad ho gayi.", variant: "destructive" });
    }
    setIsDownloading(false);
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
          {/* Dynamic Company Logo */}
          {companyConfig.company_logo ? (
            <Image
              src={companyConfig.company_logo}
              alt={`${companyConfig.company_name} Logo`}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-contain"
              unoptimized
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {companyConfig.company_name.charAt(0)}
              </span>
            </div>
          )}
          <span className="text-lg font-semibold hidden md:block">
            {companyConfig.company_name || APP_NAME}
          </span>
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpload}
          disabled={isUploading}
          className="hidden sm:flex"
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CloudUpload className="mr-2 h-4 w-4" />
          )}
          Upload
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="hidden sm:flex"
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="mr-2 h-4 w-4" />
          )}
          Download
        </Button>

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
            <DropdownMenuItem onClick={handleUpload} disabled={isUploading} className="cursor-pointer sm:hidden">
              <CloudUpload className="mr-2 h-4 w-4" />
              Upload to Cloud
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={isDownloading} className="cursor-pointer sm:hidden">
              <CloudDownload className="mr-2 h-4 w-4" />
              Download from Cloud
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
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