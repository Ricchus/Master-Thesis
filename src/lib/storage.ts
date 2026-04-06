import { createNewSession } from './randomization';
import type { SessionState } from './types';

export const STORAGE_KEY = 'office_workflow_local_v2';

type LegacySessionState = Omit<SessionState, 'version' | 'appFlow' | 'guideStep'> & {
  version: 2;
};

function migrateSession(parsed: LegacySessionState | SessionState): SessionState {
  if ((parsed as SessionState).version === 3) {
    return parsed as SessionState;
  }

  const legacy = parsed as LegacySessionState;
  return {
    ...legacy,
    version: 3,
    appFlow: legacy.rounds[1].phase === 'finished' ? 'finished' : 'study',
    guideStep: 0,
  };
}

export function loadSession(): SessionState {
  if (typeof window === 'undefined') return createNewSession();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createNewSession();

  try {
    const parsed = JSON.parse(raw) as LegacySessionState | SessionState;
    if (!parsed || (parsed.version !== 2 && parsed.version !== 3)) {
      return createNewSession();
    }
    return migrateSession(parsed);
  } catch {
    return createNewSession();
  }
}

export function saveSession(session: SessionState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, lastUpdatedAt: Date.now() }));
}

export function resetSessionStorage() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
