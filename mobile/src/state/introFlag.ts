// Intro "seen" flag. One tiny file in Documents (web preview: the file stub, mirrored to localStorage).
// Pure fallback rules live in @core/mobileLogic/introFlag and are unit tested. No network, no analytics.
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { INTRO_FLAG_KEY, INTRO_FLAG_VALUE, resolveIntroSeen, type FlagRead } from '@core/mobileLogic/introFlag';

const file = () => new File(Paths.document, INTRO_FLAG_KEY);
let cached: boolean | null = null;

async function read(): Promise<FlagRead> {
  try {
    const f = file();
    return { ok: true, value: f.exists ? (await f.text()).trim() || null : null };
  } catch {
    return { ok: false };
  }
}

export async function readIntroSeen(): Promise<boolean> {
  if (cached !== null) return cached;
  cached = resolveIntroSeen(await read());
  return cached;
}

/** Marks the intro as seen. If the write fails the in-memory value still holds for this session. */
export function markIntroSeen(): void {
  cached = true;
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(INTRO_FLAG_VALUE);
  } catch {
    /* a failed write only means the intro may show once more; it never blocks the user */
  }
}

export function useIntroSeen(): 'loading' | 'seen' | 'unseen' {
  const [s, setS] = useState<'loading' | 'seen' | 'unseen'>(cached === null ? 'loading' : cached ? 'seen' : 'unseen');
  useEffect(() => {
    let live = true;
    void readIntroSeen().then((v) => live && setS(v ? 'seen' : 'unseen'));
    return () => {
      live = false;
    };
  }, []);
  return s;
}
