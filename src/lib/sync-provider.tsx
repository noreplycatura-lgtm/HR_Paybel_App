"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAllLocalData, uploadToCloud } from './sync-helper';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  manualSync: () => Promise<void>;
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
  syncInterval = 60000
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
  const isMountedRef = useRef(true);

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

  const performSync = useCallback(async (force: boolean = false) => {
    if (isSyncing) return;
    if (typeof window === 'undefined') return;

    if (!force && !hasDataChanged()) {
      console.log('⏭️ No changes, skipping sync');
      setPendingChanges(false);
      return;
    }

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
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      if (isMountedRef.current) {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Sync failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, hasDataChanged]);

  const manualSync = useCallback(async () => {
    await performSync(true);
  }, [performSync]);

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

  // Set up auto-sync interval
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

    // First sync after 10 seconds (give time for login sync to complete)
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

  const value: SyncContextType = {
    isSyncing,
    lastSyncTime,
    syncStatus,
    syncError,
    manualSync,
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