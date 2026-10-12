import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { darkColors, lightColors, nightColors, radius, space, type Colors, type Radius, type Space } from './tokens';

export interface Theme {
  colors: Colors;
  radius: Radius;
  space: Space;
  scheme: 'light' | 'dark';
  night: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  increasedContrast: boolean;
}

interface A11yFlags {
  reduceTransparency: boolean;
  increasedContrast: boolean;
}

const NightContext = createContext<boolean>(false);

/** Forces the dark "night surface" tokens for everything below it. Used only for the recording state (D7). */
export function NightSurface({ active, children }: { active: boolean; children: ReactNode }) {
  return <NightContext.Provider value={active}>{children}</NightContext.Provider>;
}

/** Web preview only: `?scheme=light|dark` in the URL forces a colour scheme so both can be reviewed. No effect on iOS. */
function webSchemeOverride(): 'light' | 'dark' | null {
  const w = (globalThis as { window?: { location: { search: string } } }).window;
  if (Platform.OS !== 'web' || !w) return null;
  const v = new URLSearchParams(w.location.search).get('scheme');
  return v === 'light' || v === 'dark' ? v : null;
}

function useA11yFlags(): A11yFlags {
  const [f, setF] = useState<A11yFlags>({ reduceTransparency: false, increasedContrast: false });
  useEffect(() => {
    let live = true;
    // Feature-detect: react-native-web (dev preview) does not implement these.
    void AccessibilityInfo.isReduceTransparencyEnabled?.()?.then((v) => live && setF((p) => ({ ...p, reduceTransparency: v })));
    // Feature-detect: not present in every React Native version.
    const info = AccessibilityInfo as unknown as { isDarkerSystemColorsEnabled?: () => Promise<boolean> };
    void info.isDarkerSystemColorsEnabled?.().then((v) => live && setF((p) => ({ ...p, increasedContrast: v })));
    const s1 = AccessibilityInfo.addEventListener('reduceTransparencyChanged' as never, ((v: boolean) => setF((p) => ({ ...p, reduceTransparency: v }))) as never);
    const s2 = (AccessibilityInfo.addEventListener as unknown as (e: string, h: (v: boolean) => void) => { remove(): void })(
      'darkerSystemColorsChanged',
      (v) => setF((p) => ({ ...p, increasedContrast: v })),
    );
    return () => {
      live = false;
      s1?.remove?.();
      s2?.remove?.();
    };
  }, []);
  return f;
}

function contrastify(c: Colors, base: string): Colors {
  const strong = base;
  const t = (x: { bg: string; fg: string; border: string }) => ({ ...x, border: strong });
  return {
    ...c,
    separatorOpaque: strong,
    info: t(c.info),
    discuss: t(c.discuss),
    missing: t(c.missing),
    sample: t(c.sample),
    model: t(c.model),
    error: t(c.error),
  };
}

export function ThemeProvider({ children, forceScheme }: { children: ReactNode; forceScheme?: 'light' | 'dark' }) {
  const sys = useColorScheme() === 'dark' ? 'dark' : 'light';
  const scheme = forceScheme ?? webSchemeOverride() ?? sys;
  const reduceMotion = useReducedMotion();
  const flags = useA11yFlags();
  const night = useContext(NightContext);
  const value = useMemo<Theme>(() => {
    let colors = night ? nightColors : scheme === 'dark' ? darkColors : lightColors;
    if (flags.increasedContrast) colors = contrastify(colors, colors.labelSecondary);
    return { colors, radius, space, scheme: night ? 'dark' : scheme, night, reduceMotion, reduceTransparency: flags.reduceTransparency, increasedContrast: flags.increasedContrast };
  }, [scheme, night, reduceMotion, flags.reduceTransparency, flags.increasedContrast]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const ThemeContext = createContext<Theme | null>(null);

/** Re-provides the theme under a NightSurface so descendants re-resolve their tokens. */
export function ThemedNight({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <NightSurface active={active}>
      <ThemeProvider>{children}</ThemeProvider>
    </NightSurface>
  );
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used under ThemeProvider');
  return t;
}
