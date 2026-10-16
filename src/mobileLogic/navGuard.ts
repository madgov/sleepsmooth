// Double-tap guard for navigation. Pure (no React, no Expo) so the root Vitest can test it.
// A fast second tap on a row or button must not push the same screen twice, and a double tap on Back must not pop two screens.

/** About one push transition on iOS (350 ms) plus a little slack. */
export const NAV_LOCK_MS = 450;

export interface NavGuard {
  /** True when the navigation may go ahead. Records it, so the next call inside the lock window is refused. */
  allow(now?: number): boolean;
  reset(): void;
}

export function createNavGuard(lockMs: number = NAV_LOCK_MS, clock: () => number = Date.now): NavGuard {
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    allow(now = clock()) {
      if (now - lastAt < lockMs) return false;
      lastAt = now;
      return true;
    },
    reset() {
      lastAt = Number.NEGATIVE_INFINITY;
    },
  };
}
