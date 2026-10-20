import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyWearableDraft, validateDraft } from '../wearable/entries';
import { SessionProvider, useSession } from './session';
import { CONSENT_HISTORY_KEY, STORAGE_KEY, loadSession, saveSession } from './storage';

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;
beforeEach(() => sessionStorage.clear());

const reading = () => {
  const r = validateDraft({ ...emptyWearableDraft(), source: 'Example watch', values: { 'spo2-lowest': '91' } }, '2026-06-10T07:00:00.000Z');
  if (!r.ok) throw new Error('draft invalid');
  return r.observations;
};

describe('web consent history', () => {
  it('migrates a session saved before the history existed', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ consent: { purpose: 'session-storage', granted: true, at: '2026-06-01T10:00:00.000Z' }, answers: { age: 44 } }));
    const s = loadSession();
    expect(s.consentHistory).toEqual([{ id: 'consent-1', purpose: 'session-storage', version: 'web-consent-1', status: 'granted', at: '2026-06-01T10:00:00.000Z' }]);
    expect(s.consent).toEqual({ purpose: 'session-storage', granted: true, at: '2026-06-01T10:00:00.000Z' });
    expect(s.answers.age).toBe(44);
  });
  it('grant then withdraw appends two records and the latest one drives existing checks', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.setConsent(false));
    expect(result.current.consentHistory.map((r) => r.status)).toEqual(['granted', 'withdrawn']);
    expect(result.current.consent?.granted).toBe(false);
    act(() => result.current.setConsent(true));
    expect(result.current.consentHistory.map((r) => r.status)).toEqual(['granted', 'withdrawn', 'granted']);
    expect(result.current.consent?.granted).toBe(true);
  });
  it('tracks separate purposes', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.recordConsent('audio-local-analysis', true));
    act(() => result.current.recordConsent('audio-local-analysis', false));
    expect(result.current.consent?.granted).toBe(true);
    expect(result.current.consentHistory.map((r) => `${r.purpose}:${r.status}`)).toEqual(['session-storage:granted', 'audio-local-analysis:granted', 'audio-local-analysis:withdrawn']);
  });
  it('the history survives a withdrawal and a reload, while the answers do not', () => {
    const first = renderHook(() => useSession(), { wrapper });
    act(() => first.result.current.setConsent(true));
    act(() => first.result.current.setAnswers({ age: 40 }));
    act(() => first.result.current.setConsent(false));
    first.unmount();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    const second = renderHook(() => useSession(), { wrapper });
    expect(second.result.current.consentHistory.map((r) => r.status)).toEqual(['granted', 'withdrawn']);
    expect(second.result.current.answers).toEqual({});
  });
  it('withdrawing something never granted records nothing', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(false));
    expect(result.current.consentHistory).toEqual([]);
    expect(sessionStorage.getItem(CONSENT_HISTORY_KEY)).toBeNull();
  });
  it('Delete my data clears the history and every key', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.setConsent(false));
    act(() => result.current.deleteMyData());
    expect(result.current.consentHistory).toEqual([]);
    expect(result.current.consent).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('web wearable readings', () => {
  it('are kept only with session-storage consent and reload with it', () => {
    const first = renderHook(() => useSession(), { wrapper });
    act(() => first.result.current.setWearable(reading()));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => first.result.current.setConsent(true));
    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('spo2-lowest');
    first.unmount();
    const second = renderHook(() => useSession(), { wrapper });
    expect(second.result.current.wearable).toHaveLength(1);
    expect(second.result.current.wearable[0]?.entryMethod).toBe('user-entered');
  });
  it('are removed by Delete my data and by withdrawing consent from storage', () => {
    const { result } = renderHook(() => useSession(), { wrapper });
    act(() => result.current.setConsent(true));
    act(() => result.current.setWearable(reading()));
    act(() => result.current.setConsent(false));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => result.current.setConsent(true));
    act(() => result.current.setWearable(reading()));
    act(() => result.current.deleteMyData());
    expect(result.current.wearable).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });
  it('saveSession drops invalid stored readings on load', () => {
    const s = loadSession();
    saveSession({ ...s, consentHistory: [{ id: 'consent-1', purpose: 'session-storage', version: 'v', status: 'granted', at: '2026-06-01T10:00:00.000Z' }], wearable: [{ ...reading()[0]!, value: 9999 }] });
    expect(loadSession().wearable).toEqual([]);
  });
});
