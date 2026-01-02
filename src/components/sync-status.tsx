"use client";

import React from 'react';
import { useSyncContext } from '@/lib/sync-provider';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SyncStatus() {
  const { 
    isSyncing, 
    lastSyncTime, 
    syncStatus, 
    syncError, 
    manualSync,
    autoSyncEnabled,
    setAutoSyncEnabled 
  } = useSyncContext();

  const getStatusIcon = () => {
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Cloud className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (syncError) return `Error: ${syncError}`;
    if (lastSyncTime) {
      return `Synced: ${lastSyncTime.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })}`;
    }
    return 'Not synced';
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Auto-sync toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              className={`h-7 w-7 p-0 ${autoSyncEnabled ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}`}
            >
              {autoSyncEnabled ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{autoSyncEnabled ? 'Auto-sync ON (10s)' : 'Auto-sync OFF'}</p>
            <p className="text-xs text-muted-foreground">Click to {autoSyncEnabled ? 'disable' : 'enable'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Sync status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground cursor-default">
              {getStatusIcon()}
              <span className="hidden md:inline max-w-[120px] truncate">{getStatusText()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{getStatusText()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Manual sync button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={manualSync}
              disabled={isSyncing}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Sync Now</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}