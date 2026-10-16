import { Platform } from 'react-native';

/**
 * Dev-only stress switches for the web preview, read from the URL. Never active in a release build or on a device:
 * `__DEV__` is false in release, and the web check keeps it off native dev builds too.
 *   ?fontscale=1.35   multiplies text sizes the way iOS Dynamic Type would (respects each text's own cap)
 *   ?nights=30        lists N stress nights (clones of the labelled sample view, ids "stress-N") instead of the real store
 */
function param(name: string): string | null {
  const w = (globalThis as { window?: { location?: { search?: string } } }).window;
  if (!__DEV__ || Platform.OS !== 'web' || !w?.location) return null;
  try {
    return new URLSearchParams(w.location.search).get(name);
  } catch {
    return null;
  }
}

let cachedScale: number | undefined;
export function devFontScale(): number {
  if (cachedScale === undefined) {
    const n = Number(param('fontscale'));
    cachedScale = Number.isFinite(n) && n >= 1 && n <= 3.5 ? n : 1;
  }
  return cachedScale;
}

export function devStressNightCount(): number | null {
  const v = param('nights');
  if (v === null) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 200 ? n : null;
}

/** ?adapt=4: web preview only, pretends 4 real-night clips were reviewed (to see the clip-adaptation note). */
export function devAdaptReviewed(): number | null {
  const v = param('adapt');
  if (v === null) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null;
}

/** ?pauses=3: web preview only. Shows the "paused and restarted" line on the labelled SAMPLE night with N = 3 to review the layout. Real nights always use their real count. */
export function devSnorePausesPreview(): number | null {
  const v = param('pauses');
  if (v === null) return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null;
}
