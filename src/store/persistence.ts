import { TicketFilterState } from '@/src/types/ticket';

/**
 * SSR-safe localStorage persistence for the active agent + ticket filters.
 * No redux-persist: a plain fixed-key JSON blob read/written only in the browser.
 * All window/localStorage access is guarded so this is safe to import on the server.
 */

const STORAGE_KEY = 'freeflow-support-desk:v1';

export interface PersistedState {
  activeAgentId?: string;
  filters?: Partial<TicketFilterState>;
}

export function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    // Corrupt JSON or unavailable storage — treat as no persisted state.
    return null;
  }
}

export function persistState(state: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota / privacy mode — persistence is best-effort.
  }
}
