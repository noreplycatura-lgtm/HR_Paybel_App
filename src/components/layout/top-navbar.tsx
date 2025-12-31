"use client";

import Link from "next/link";
import { UserCircle, LogOut, CloudUpload, CloudDownload, Loader2, Bell, PanelLeftClose, PanelLeft } from "lucide-react";
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
    console.error("Error adding to activity log:", error);
  }
};

export function TopNavbar() {
  const { toggleSidebar, state } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [companyConfig, setCompanyConfig] = React.useState<CompanyConfig>({
    company_logo: '',
    company_name: APP_NAME
  });

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const config = await getCompanyConfig();
        if (config) setCompanyConfig(config);
      } catch (error) {
        console.error('Error fetching config:', error);
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
        toast({ title: "✅ Upload Success", description: "Data saved to cloud!" });
        addActivityLog('Data uploaded to cloud.');
      } else {
        toast({ title: "Upload Failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
    setIsUploading(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const success = await downloadFromCloud();
      if (success) {
        toast({ title: "✅ Download Success", description: "Data loaded from cloud!" });
        addActivityLog('Data downloaded from cloud.');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast({ title: "Download Failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    }
    setIsDownloading(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6 print:hidden">
      {/* Sidebar Toggle */}
      <Button 
        size="icon" 
        variant="ghost" 
        onClick={toggleSidebar}
        className="h-10 w-10 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
        title={state === 'expanded' ? 'Hide Sidebar' : 'Show Sidebar'}
      >
        {state === 'expanded' ? (
          <PanelLeftClose className="h-5 w-5" />
        ) : (
          <PanelLeft className="h-5 w-5" />
        )}
      </Button>

      {/* Brand */}
      <span className="hidden md:block text-lg font-semibold text-gray-800">
        {companyConfig.company_name || APP_NAME}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Upload */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpload}
          disabled={isUploading}
          className="hidden sm:flex gap-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
          <span className="hidden lg:inline">Upload</span>
        </Button>

        {/* Download */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="hidden sm:flex gap-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="h-4 w-4" />
          )}
          <span className="hidden lg:inline">Download</span>
        </Button>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-gray-200 mx-2" />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-lg">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"
            >
              <UserCircle className="h-6 w-6 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white border shadow-lg rounded-xl">
            <DropdownMenuLabel className="p-3">
              <p className="text-sm font-semibold text-gray-800">Admin User</p>
              <p className="text-xs text-gray-500">admin@novita.com</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleUpload} disabled={isUploading} className="sm:hidden cursor-pointer text-green-600">
              <CloudUpload className="mr-2 h-4 w-4" />
              Upload to Cloud
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={isDownloading} className="sm:hidden cursor-pointer text-blue-600">
              <CloudDownload className="mr-2 h-4 w-4" />
              Download from Cloud
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
            
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}