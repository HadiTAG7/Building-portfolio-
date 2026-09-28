"use client";

import { create } from "zustand";

interface UiState {
  libraryOpen: boolean;
  /** Portfolio being saved to the team library, if the save dialog is open. */
  saveTargetId: string | null;
  toast: string | null;
  openLibrary: () => void;
  closeLibrary: () => void;
  openSave: (portfolioId: string) => void;
  closeSave: () => void;
  notify: (message: string) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set) => ({
  libraryOpen: false,
  saveTargetId: null,
  toast: null,
  openLibrary: () => set({ libraryOpen: true }),
  closeLibrary: () => set({ libraryOpen: false }),
  openSave: (portfolioId) => set({ saveTargetId: portfolioId }),
  closeSave: () => set({ saveTargetId: null }),
  notify: (message) => {
    clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },
  clearToast: () => set({ toast: null }),
}));
