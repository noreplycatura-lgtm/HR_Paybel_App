import { loadFromGoogleSheet, saveToGoogleSheet, AppData } from './google-sheets';

const LOCAL_STORAGE_KEY = 'salaryAppData';

// Local storage se data lo
export function getLocalData(): AppData {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

// Local storage me data save karo
export function setLocalData(data: AppData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

// Google Sheet se data load karke local me save karo
export async function syncFromCloud(): Promise<AppData> {
  const cloudData = await loadFromGoogleSheet();
  if (Object.keys(cloudData).length > 0) {
    setLocalData(cloudData);
  }
  return cloudData;
}

// Local data ko Google Sheet me save karo
export async function syncToCloud(): Promise<boolean> {
  const localData = getLocalData();
  return await saveToGoogleSheet(localData);
}

// Full sync - pehle cloud se lo, phir local me save karo
export async function fullSync(): Promise<AppData> {
  const cloudData = await loadFromGoogleSheet();
  const localData = getLocalData();
  
  // Agar cloud me data hai to wo use karo, warna local
  if (Object.keys(cloudData).length > 0) {
    setLocalData(cloudData);
    return cloudData;
  }
  
  return localData;
}