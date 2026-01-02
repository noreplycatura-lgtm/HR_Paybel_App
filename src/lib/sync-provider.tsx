"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAllLocalData, uploadToCloud, downloadFromCloud } from './sync-helper';

// Key to track if this device has been initialized
const DEVICE_INITIALIZED_KEY = 'novita_device_initialized_v1';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'downloading';
  syncError: string | null;
  manualSync: () => Promise<void>;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  pendingChanges: boolean;
  isInitialized: boolean;
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

// Generate hash of data to detect changes
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
  syncInterval = 60000  // 60 seconds
}: SyncProviderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'downloading'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedHashRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Check if this device has been initialized before
  const checkDeviceInitialized = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DEVICE_INITIALIZED_KEY) === 'true';
  }, []);

  // Mark device as initialized
  const markDeviceInitialized = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEVICE_INITIALIZED_KEY, 'true');
  }, []);

  // Check if data has changed
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

  // Initial download for new device
  const performInitialDownload = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    console.log('📥 New device detected, downloading data from server...');
    setSyncStatus('downloading');

    try {
      const success = await downloadFromCloud();
      
      if (success && isMountedRef.current) {
        // Mark device as initialized
        markDeviceInitialized();
        
        // Update hash after download
        const currentData = getAllLocalData();
        lastSyncedHashRef.current = generateDataHash(currentData);
        
        setIsInitialized(true);
        setSyncStatus('success');
        setLastSyncTime(new Date());
        console.log('✅ Initial download complete');
        return true;
      } else {
        // Even if download fails (empty server), mark as initialized
        // This means it's a brand new setup
        markDeviceInitialized();
        setIsInitialized(true);
        setSyncStatus('idle');
        console.log('ℹ️ No data on server, starting fresh');
        return true;
      }
    } catch (error) {
      console.error('❌ Initial download error:', error);
      if (isMountedRef.current) {
        setSyncStatus('error');
        setSyncError('Failed to download initial data');
      }
      return false;
    }
  }, [markDeviceInitialized]);

  // Main sync function - Only syncs if data changed
  const performSync = useCallback(async (force: boolean = false) => {
    // Don't sync if not initialized yet
    if (!isInitialized) {
      console.log('⏭️ Not initialized yet, skipping sync');
      return;
    }

    if (isSyncing) return;
    if (typeof window === 'undefined') return;

    // Check if data actually changed (unless forced)
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
        // Update the hash after successful sync
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
  }, [isSyncing, hasDataChanged, isInitialized]);

  // Manual sync - Always forces sync
  const manualSync = useCallback(async () => {
    if (!isInitialized) {
      await performInitialDownload();
      return;
    }
    await performSync(true);
  }, [performSync, isInitialized, performInitialDownload]);

  // Debounced change detection
  const checkForChanges = useCallback(() => {
    if (!isInitialized) return;
    if (hasDataChanged()) {
      setPendingChanges(true);
    }
  }, [hasDataChanged, isInitialized]);

  // FIRST: Check if device is initialized, if not, download data
  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === 'undefined') return;

    const initializeDevice = async () => {
      const alreadyInitialized = checkDeviceInitialized();
      
      if (alreadyInitialized) {
        console.log('✅ Device already initialized');
        setIsInitialized(true);
        
        // Set initial hash
        const currentData = getAllLocalData();
        lastSyncedHashRef.current = generateDataHash(currentData);
      } else {
        // New device - download data first
        await performInitialDownload();
      }
    };

    // Small delay to ensure app is ready
    const initTimeout = setTimeout(() => {
      initializeDevice();
    }, 1000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimeout);
    };
  }, [checkDeviceInitialized, performInitialDownload]);

  // Set up auto-sync interval (only after initialization)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return; // Don't start auto-sync until initialized

    if (!autoSyncEnabled) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      console.log('🔴 Auto-sync disabled');
      return;
    }

    // Set up interval - Check and sync every 60 seconds
    syncIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        performSync(false);
      }
    }, syncInterval);

    console.log(`🟢 Auto-sync: Every ${syncInterval / 1000}s`);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSyncEnabled, syncInterval, performSync, isInitialized]);

  // Listen for localStorage changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;

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
  }, [checkForChanges, isInitialized]);

  // Check for changes periodically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInitialized) return;

    const changeCheckInterval = setInterval(() => {
      checkForChanges();
    }, 10000);

    return () => clearInterval(changeCheckInterval);
  }, [checkForChanges, isInitialized]);

  const value: SyncContextType = {
    isSyncing,
    lastSyncTime,
    syncStatus,
    syncError,
    manualSync,
    autoSyncEnabled,
    setAutoSyncEnabled,
    pendingChanges,
    isInitialized,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}