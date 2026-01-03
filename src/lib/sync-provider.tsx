"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAllLocalData, uploadToCloud } from './sync-helper';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  manualSync: () => Promise<void>;
  triggerSync: () => void; // New: For action-based sync
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  pendingChanges: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
}

interface SyncProviderProps {
  children: React.ReactNode;
  syncInterval?: number;
}

function generateDataHash(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

export function SyncProvider({ 
  children, 
  syncInterval = 30000  // 30 seconds
}: SyncProviderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(false);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedHashRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const actionSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isSyncingRef = useRef(false); // To prevent race conditions

  const hasDataChanged = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      const currentData = getAllLocalData();
      const currentHash = generateDataHash(currentData);
      
      if (currentHash !== lastSyncedHashRef.current) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Core sync function
  const performSync = useCallback(async (force: boolean = false): Promise<boolean> => {
    if (isSyncingRef.current) return false;
    if (typeof window === 'undefined') return false;

    if (!force && !hasDataChanged()) {
      setPendingChanges(false);
      return false;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const success = await uploadToCloud();
      
      if (success && isMountedRef.current) {
        const currentData = getAllLocalData();
        lastSyncedHashRef.current = generateDataHash(currentData);
        
        setLastSyncTime(new Date());
        setSyncStatus('success');
        setPendingChanges(false);
        console.log('✅ Synced:', new Date().toLocaleTimeString());
        return true;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      if (isMountedRef.current) {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Sync failed');
      }
      return false;
    } finally {
      isSyncingRef.current = false;
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [hasDataChanged]);

  // Manual sync - Always forces sync
  const manualSync = useCallback(async () => {
    await performSync(true);
  }, [performSync]);

  // Trigger sync after actions (debounced 3 seconds)
  const triggerSync = useCallback(() => {
    setPendingChanges(true);
    
    // Clear existing timer
    if (actionSyncTimerRef.current) {
      clearTimeout(actionSyncTimerRef.current);
    }
    
    // Sync after 3 seconds of no activity
    actionSyncTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        performSync(false);
      }
    }, 3000);
  }, [performSync]);

  // Check for changes
  const checkForChanges = useCallback(() => {
    if (hasDataChanged()) {
      setPendingChanges(true);
    }
  }, [hasDataChanged]);

  // Initialize hash on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === 'undefined') return;

    // Set initial hash
    const currentData = getAllLocalData();
    lastSyncedHashRef.current = generateDataHash(currentData);

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Set up auto-sync interval (30 seconds)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!autoSyncEnabled) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      console.log('🔴 Auto-sync disabled');
      return;
    }

    // First sync after 10 seconds
    const initialSyncTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        performSync(false);
      }
    }, 10000);

    // Set up interval
    syncIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        performSync(false);
      }
    }, syncInterval);

    console.log(`🟢 Auto-sync: Every ${syncInterval / 1000}s`);

    return () => {
      clearTimeout(initialSyncTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSyncEnabled, syncInterval, performSync]);

  // 🆕 Sync on Tab/Window Close (beforeunload)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are pending changes
      if (hasDataChanged() || pendingChanges) {
        // Attempt sync using sendBeacon for reliability
        try {
          const data = getAllLocalData();
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          
          // Use sendBeacon for reliable delivery on page close
          const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxw-u0CqbhNDyhUlQUN1s8Mdh21-o3VeqWLI9IW_6XXCUhz2jNefyyXlmsqy1g7PUw1/exec';
          navigator.sendBeacon(WEBAPP_URL, blob);
          
          console.log('📤 Beacon sync on close');
        } catch (error) {
          console.error('Beacon sync failed:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasDataChanged, pendingChanges]);

  // 🆕 Sync on Tab Visibility Change (when user switches tabs)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched away from tab - sync if needed
        if (hasDataChanged() || pendingChanges) {
          performSync(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [performSync, hasDataChanged, pendingChanges]);

  // Listen for localStorage changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        checkForChanges();
      }, 1000);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localDataChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localDataChanged', handleStorageChange);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [checkForChanges]);

  // Check for changes every 10 seconds
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const changeCheckInterval = setInterval(() => {
      checkForChanges();
    }, 10000);

    return () => clearInterval(changeCheckInterval);
  }, [checkForChanges]);

  // Cleanup action sync timer
  useEffect(() => {
    return () => {
      if (actionSyncTimerRef.current) {
        clearTimeout(actionSyncTimerRef.current);
      }
    };
  }, []);

  const value: SyncContextType = {
    isSyncing,
    lastSyncTime,
    syncStatus,
    syncError,
    manualSync,
    triggerSync,
    autoSyncEnabled,
    setAutoSyncEnabled,
    pendingChanges,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}