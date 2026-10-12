// Intro slideshow "seen" flag: pure read/fallback logic (the file IO lives in mobile/src/state/introFlag.ts).
// Rule: never trap a user in the intro. Only a clean read that finds nothing means "not seen yet".

export const INTRO_FLAG_KEY = 'sleepsmooth.onboarded.v1';
export const INTRO_FLAG_VALUE = '1';

export type FlagRead = { ok: true; value: string | null } | { ok: false };

/** True when the intro should be treated as already seen. A failed or unreadable read counts as seen. */
export function resolveIntroSeen(read: FlagRead): boolean {
  if (!read.ok) return true;
  if (read.value === null) return false;
  return true;
}

/** Wraps a synchronous reader so an exception becomes a failed read. */
export function safeRead(reader: () => string | null): FlagRead {
  try {
    return { ok: true, value: reader() };
  } catch {
    return { ok: false };
  }
}
