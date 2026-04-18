import { createNewSession } from './randomization';
import type { RoundState, SessionState } from './types';

export const STORAGE_KEY = 'office_workflow_local_v2';

type V4RoundState = Omit<RoundState, 'countdownPausedAt' | 'countdownPausedTotalMs'>;

type LegacySessionState = Omit<SessionState, 'version' | 'appFlow' | 'guideStep' | 'rounds'> & {
  version: 2;
  rounds: [V4RoundState, V4RoundState];
};

type TransitionalSessionState = Omit<SessionState, 'version' | 'rounds'> & {
  version: 3;
  rounds: [V4RoundState, V4RoundState];
};

type V4SessionState = Omit<SessionState, 'version' | 'rounds'> & {
  version: 4;
  rounds: [V4RoundState, V4RoundState];
};

function migrateRound(round: V4RoundState | RoundState): RoundState {
  const migrated = round as RoundState;
  const isPausedPhase =
    migrated.phase === 'ema2' ||
    migrated.phase === 'ema3' ||
    migrated.phase === 'ema4';

  return {
    ...migrated,
    countdownPausedAt: migrated.countdownPausedAt ?? (isPausedPhase && migrated.startedAt ? Date.now() : null),
    countdownPausedTotalMs: migrated.countdownPausedTotalMs ?? 0,
  };
}

function migrateSession(parsed: LegacySessionState | TransitionalSessionState | V4SessionState | SessionState): SessionState {
  if ((parsed as SessionState).version === 5) {
    const current = parsed as SessionState;
    return {
      ...current,
      rounds: current.rounds.map((round) => migrateRound(round)) as SessionState['rounds'],
    };
  }

  if ((parsed as V4SessionState).version === 4) {
    const previous = parsed as V4SessionState;
    return {
      ...previous,
      version: 5,
      rounds: previous.rounds.map((round) => migrateRound(round)) as SessionState['rounds'],
    };
  }

  if ((parsed as TransitionalSessionState).version === 3) {
    const transitional = parsed as TransitionalSessionState;
    return {
      ...transitional,
      version: 5,
      rounds: transitional.rounds.map((round) => migrateRound(round as V4RoundState)) as SessionState['rounds'],
    };
  }

  const legacy = parsed as LegacySessionState;
  return {
    ...legacy,
    version: 5,
    appFlow: legacy.rounds[1].phase === 'finished' ? 'finished' : 'study',
    guideStep: 0,
    rounds: legacy.rounds.map((round) => migrateRound(round as V4RoundState)) as SessionState['rounds'],
  };
}

export function loadSession(): SessionState {
  if (typeof window === 'undefined') return createNewSession();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createNewSession();

  try {
    const parsed = JSON.parse(raw) as LegacySessionState | TransitionalSessionState | V4SessionState | SessionState;
    if (!parsed || (parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== 5)) {
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
