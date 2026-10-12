/// <reference lib="webworker" />
// Web Worker: receives a transferred mono Float32Array, runs analyzeAudio. No AudioContext here.
// Cancel messages are handled because analyzeAudio yields to the event loop between chunks.
import { analyzeAudio, AnalysisCancelledError } from './analyze';
import { shippedModelHook } from './modelHook';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let cancelled = false;
const post = (m: WorkerResponse) => ctx.postMessage(m);

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  cancelled = false;
  try {
    const analysis = await analyzeAudio(msg.samples, msg.sampleRate, {
      isSynthetic: msg.isSynthetic,
      isCancelled: () => cancelled,
      onProgress: (fraction, stage) => post({ type: 'progress', fraction, stage }),
      inference: shippedModelHook(), // null when no model ships (ER-9)
    });
    post({ type: 'done', analysis });
  } catch (err) {
    if (err instanceof AnalysisCancelledError) post({ type: 'cancelled' });
    else post({ type: 'error', message: err instanceof Error ? err.message : 'Analysis failed' });
  }
};
