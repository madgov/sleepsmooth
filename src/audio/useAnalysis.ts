// React hook: decode on the main thread, analyze in a worker, with progress and cancel.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioAnalysis } from '../types/audio';
import { AudioInputError, decodeAudioFile } from './decode';
import type { WorkerResponse } from './workerProtocol';

export type AnalysisPhase = 'idle' | 'decoding' | 'analyzing' | 'done' | 'error' | 'cancelled';

export interface AnalysisState {
  phase: AnalysisPhase;
  progress: number;
  analysis: AudioAnalysis | null;
  error: { message: string; recovery: string } | null;
}

const IDLE: AnalysisState = { phase: 'idle', progress: 0, analysis: null, error: null };

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(IDLE);
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);
  useEffect(() => stopWorker, [stopWorker]);

  const runSamples = useCallback(
    (samples: Float32Array, sampleRate: number, isSynthetic = false) => {
      const id = ++runId.current;
      stopWorker();
      setState({ phase: 'analyzing', progress: 0, analysis: null, error: null });
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (id !== runId.current) return;
        const m = e.data;
        if (m.type === 'progress') setState((s) => ({ ...s, progress: m.fraction }));
        else if (m.type === 'done') {
          setState({ phase: 'done', progress: 1, analysis: m.analysis, error: null });
          stopWorker();
        } else if (m.type === 'cancelled') setState({ ...IDLE, phase: 'cancelled' });
        else {
          setState({ ...IDLE, phase: 'error', error: { message: 'The analysis could not finish.', recovery: 'Try again, or use the labeled sample.' } });
          stopWorker();
        }
      };
      worker.onerror = () => {
        if (id !== runId.current) return;
        setState({ ...IDLE, phase: 'error', error: { message: 'The analysis could not start in this browser.', recovery: 'Try another browser, or use the labeled sample.' } });
        stopWorker();
      };
      // Transfer (zero-copy): the buffer is detached on this thread afterwards.
      worker.postMessage({ type: 'analyze', samples, sampleRate, isSynthetic }, [samples.buffer]);
    },
    [stopWorker],
  );

  const start = useCallback(
    async (file: File) => {
      const id = ++runId.current;
      stopWorker();
      setState({ phase: 'decoding', progress: 0, analysis: null, error: null });
      try {
        const decoded = await decodeAudioFile(file);
        if (id !== runId.current) return;
        runSamples(decoded.samples, decoded.sampleRate);
      } catch (err) {
        if (id !== runId.current) return;
        const e =
          err instanceof AudioInputError
            ? { message: err.message, recovery: err.recovery }
            : { message: 'Something went wrong reading that file.', recovery: 'Try another file, or use the labeled sample.' };
        setState({ ...IDLE, phase: 'error', error: e });
      }
    },
    [runSamples, stopWorker],
  );

  const cancel = useCallback(() => {
    runId.current++;
    workerRef.current?.postMessage({ type: 'cancel' });
    stopWorker();
    setState({ ...IDLE, phase: 'cancelled' });
  }, [stopWorker]);

  const reset = useCallback(() => {
    runId.current++;
    stopWorker();
    setState(IDLE);
  }, [stopWorker]);

  return { state, start, runSamples, cancel, reset };
}
