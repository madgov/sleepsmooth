import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoCase } from '../demo';
import { SessionProvider, useSession } from './session';
import { STORAGE_KEY } from './storage';

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;

beforeEach(() => sessionStorage.clear());

describe('session state', () => {
  it('does not persist before consent', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setAnswers({ age: 40 }));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('persists answers after consent and never any audio', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.setAnswers({ age: 40 }));
    act(() => result.current.setAudio(demoCase.audio));
    expect(result.current.audio).not.toBeNull();
    const all = Object.keys(sessionStorage).map((k) => `${k}=${sessionStorage.getItem(k)}`).join('\n');
    expect(all).toContain('"age":40');
    for (const k of ['loudness', 'windows', 'quietGaps', 'quality', 'snoreLikeFraction', 'modelVersion']) expect(all).not.toContain(k);
  });
  it('reloads persisted answers', () => {
    const first = renderHook(() => useSession(), { wrapper });
    act(() => first.result.current.setConsent(true));
    act(() => first.result.current.setAnswers({ age: 41 }));
    first.unmount();
    const second = renderHook(() => useSession(), { wrapper });
    expect(second.result.current.answers.age).toBe(41);
  });
  it('Delete my data clears everything', () => {
    sessionStorage.setItem('sleepsmooth.other', 'x');
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.setAnswers({ age: 40 }));
    act(() => result.current.setAudio(demoCase.audio));
    act(() => result.current.deleteMyData());
    expect(result.current.answers).toEqual({});
    expect(result.current.audio).toBeNull();
    expect(result.current.consent).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it('provider renders', () => {
    render(<SessionProvider>ok</SessionProvider>);
  });
});
