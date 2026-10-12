// Single-clip player state, independent of the audio engine. One clip plays at a time; tapping another stops the first.
import { useSyncExternalStore } from 'react';

export interface PlayHandle {
  stop(): void;
}
export interface PlayEngine {
  /** False when this runtime cannot play audio (Expo Go preview). */
  available: boolean;
  unavailableReason: string;
  start(samples: Float32Array, rate: number, onProgress: (p01: number) => void, onEnd: () => void): PlayHandle;
}
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error';
export interface PlayerState {
  id: string | null;
  status: PlayerStatus;
  progress: number;
  message: string | null;
}
const IDLE: PlayerState = { id: null, status: 'idle', progress: 0, message: null };

export interface ClipSamples {
  samples: Float32Array;
  rate: number;
}

export function createPlayer(engine: PlayEngine) {
  let state: PlayerState = IDLE;
  let handle: PlayHandle | null = null;
  let token = 0;
  const listeners = new Set<() => void>();
  const set = (s: PlayerState) => {
    state = s;
    listeners.forEach((l) => l());
  };
  const stop = () => {
    token++;
    handle?.stop();
    handle = null;
    set(IDLE);
  };
  async function toggle(id: string, load: () => Promise<ClipSamples | null>): Promise<void> {
    if (state.id === id && (state.status === 'playing' || state.status === 'loading')) return stop();
    stop();
    if (!engine.available) return set({ id, status: 'error', progress: 0, message: engine.unavailableReason });
    const mine = ++token;
    set({ id, status: 'loading', progress: 0, message: null });
    try {
      const data = await load();
      if (mine !== token) return;
      if (!data) return set({ id, status: 'error', progress: 0, message: 'This clip could not be opened.' });
      handle = engine.start(
        data.samples,
        data.rate,
        (p) => mine === token && set({ id, status: 'playing', progress: Math.min(1, Math.max(0, p)), message: null }),
        () => mine === token && stop(),
      );
      set({ id, status: 'playing', progress: 0, message: null });
    } catch {
      if (mine === token) set({ id, status: 'error', progress: 0, message: 'Playback did not start.' });
    }
  }
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const getState = () => state;
  return { toggle, stop, subscribe, getState, available: engine.available, unavailableReason: engine.unavailableReason };
}

export type ClipPlayer = ReturnType<typeof createPlayer>;

export function usePlayerState(p: ClipPlayer): PlayerState {
  return useSyncExternalStore(p.subscribe, p.getState, p.getState);
}
