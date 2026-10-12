import { describe, expect, it } from 'vitest';
import { INTRO_FLAG_KEY, resolveIntroSeen, safeRead } from './introFlag';

describe('intro flag', () => {
  it('uses the versioned key', () => expect(INTRO_FLAG_KEY).toBe('sleepsmooth.onboarded.v1'));
  it('nothing stored: show the intro', () => expect(resolveIntroSeen({ ok: true, value: null })).toBe(false));
  it('flag stored: seen', () => expect(resolveIntroSeen({ ok: true, value: '1' })).toBe(true));
  it('any stored value counts as seen', () => expect(resolveIntroSeen({ ok: true, value: 'x' })).toBe(true));
  it('failed read: treat as seen, never trap the user', () => expect(resolveIntroSeen({ ok: false })).toBe(true));
  it('safeRead turns a throw into a failed read', () => {
    expect(safeRead(() => { throw new Error('io'); })).toEqual({ ok: false });
    expect(safeRead(() => null)).toEqual({ ok: true, value: null });
    expect(safeRead(() => '1')).toEqual({ ok: true, value: '1' });
  });
});
