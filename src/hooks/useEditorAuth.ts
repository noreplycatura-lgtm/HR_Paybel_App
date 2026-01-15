
// This file can be deleted as the editor auth logic is no longer in use.
// Keeping it for now, but it's not imported or used by any active component.
// To fully remove, delete this file and any lingering imports of useEditorAuth.

'use client';
import { useState, useEffect, useCallback } from 'react';

const EDITOR_STORAGE_KEY = 'catura_editor_auth_status_v1'; 

export function useEditorAuth() {
  const [isEditor, setIsEditor] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); 

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedStatus = localStorage.getItem(EDITOR_STORAGE_KEY);
        setIsEditor(storedStatus === 'true');
      } catch (e) {
        console.error("Error accessing localStorage for editor auth:", e);
        setIsEditor(false);
      }
      setIsLoadingAuth(false);
    }
  }, []);

  const loginAsEditor = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(EDITOR_STORAGE_KEY, 'true');
        setIsEditor(true);
      } catch (e) {
        console.error("Error setting editor auth in localStorage:", e);
      }
    }
  }, []);

  const logoutEditor = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(EDITOR_STORAGE_KEY);
        setIsEditor(false);
      } catch (e) {
        console.error("Error removing editor auth from localStorage:", e);
      }
    }
  }, []);

  return { isEditor, loginAsEditor, logoutEditor, isLoadingAuth };
}
