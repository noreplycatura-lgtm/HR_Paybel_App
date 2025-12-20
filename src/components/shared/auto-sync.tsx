"use client";

import * as React from "react";
import { uploadToCloud, downloadFromCloud } from "@/lib/sync-helper";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, CloudUpload, RefreshCw } from "lucide-react";

export function AutoSync() {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<"idle" | "syncing" | "downloading" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);

  // 1. STARTUP: App khulte hi Cloud se Data Download karo
  React.useEffect(() => {
    const initDownload = async () => {
      setStatus("downloading");
      console.log("Auto Sync: Downloading latest data...");
      
      try {
        const success = await downloadFromCloud();
        
        if (success) {
          setLastSyncTime(new Date());
          setStatus("idle");
          toast({ 
            title: "Data Synced", 
            description: "Cloud se latest data load ho gaya hai." 
          });
        } else {
          setStatus("idle");
        }
      } catch (e) {
        setStatus("idle");
      }
    };

    const timer = setTimeout(() => {
      initDownload();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // 2. BACKGROUND: Har 20 Seconds me Data Upload karo
  React.useEffect(() => {
    const intervalId = setInterval(async () => {
      setStatus("syncing");
      
      try {
        const success = await uploadToCloud();
        
        if (success) {
          setLastSyncTime(new Date());
          setStatus("idle");
        } else {
          setStatus("error");
        }
      } catch (e) {
        setStatus("error");
      }
    }, 20000); 

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md border backdrop-blur-sm print:hidden transition-all duration-300">
      {status === "downloading" && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
          <span className="text-blue-600">Loading Data...</span>
        </>
      )}
      
      {status === "syncing" && (
        <>
          <CloudUpload className="h-3 w-3 animate-bounce text-orange-500" />
          <span className="text-orange-600">Saving...</span>
        </>
      )}
      
      {status === "idle" && lastSyncTime && (
        <>
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span className="text-slate-500">
            Saved {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </>
      )}
      
      {status === "error" && (
        <span className="text-red-500 flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Offline
        </span>
      )}
    </div>
  );
}