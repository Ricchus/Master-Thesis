import { createNewSession } from './randomization';
import type { SessionState } from './types';

export const STORAGE_KEY = 'office_workflow_local_v2';

type LegacySessionState = Omit<SessionState, 'version' | 'appFlow' | 'guideStep'> & {
  version: 2;
};

type TransitionalSessionState = SessionState & {
  version: 3;
};

function migrateSession(parsed: LegacySessionState | TransitionalSessionState | SessionState): SessionState {
  if ((parsed as SessionState).version === 4) {
    return parsed as SessionState;
  }

  if ((parsed as TransitionalSessionState).version === 3) {
    const transitional = parsed as TransitionalSessionState;
    return {
      ...transitional,
      version: 4,
    };
  }

  const legacy = parsed as LegacySessionState;
  return {
    ...legacy,
    version: 4,
    appFlow: legacy.rounds[1].phase === 'finished' ? 'finished' : 'study',
    guideStep: 0,
  };
}

export function loadSession(): SessionState {
  if (typeof window === 'undefined') return createNewSession();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createNewSession();

  try {
    const parsed = JSON.parse(raw) as LegacySessionState | TransitionalSessionState | SessionState;
    if (!parsed || (parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4)) {
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
