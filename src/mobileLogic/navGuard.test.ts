import { describe, expect, it } from 'vitest';
import { createNavGuard, NAV_LOCK_MS } from './navGuard';

describe('createNavGuard', () => {
  it('allows the first navigation', () => {
    expect(createNavGuard().allow(1000)).toBe(true);
  });
  it('refuses a second navigation inside the lock window (double tap)', () => {
    const g = createNavGuard();
    expect(g.allow(1000)).toBe(true);
    expect(g.allow(1000 + NAV_LOCK_MS - 1)).toBe(false);
  });
  it('allows again once the window has passed', () => {
    const g = createNavGuard();
    g.allow(1000);
    expect(g.allow(1000 + NAV_LOCK_MS)).toBe(true);
  });
  it('a refused tap does not extend the window', () => {
    const g = createNavGuard();
    g.allow(0);
    g.allow(200);
    expect(g.allow(NAV_LOCK_MS)).toBe(true);
  });
  it('reset clears the lock', () => {
    const g = createNavGuard();
    g.allow(0);
    g.reset();
    expect(g.allow(1)).toBe(true);
  });
  it('uses the injected clock when no time is given', () => {
    let t = 5000;
    const g = createNavGuard(100, () => t);
    expect(g.allow()).toBe(true);
    t += 50;
    expect(g.allow()).toBe(false);
    t += 60;
    expect(g.allow()).toBe(true);
  });
});
