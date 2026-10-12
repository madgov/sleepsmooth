import { useRef, useState, type DragEvent } from 'react';
import type { AudioAnalysis } from '../types/audio';
import type { ConsentRecord } from '../types/questionnaire';
import { ConsentGate, ErrorState, LoadingState, LoudnessChart, QualityPanel, SourceBadge } from '../components';
import { useAnalysis } from '../audio/useAnalysis';
import {
  OWN_RECORDING_HEADING,
  SAMPLE_AUDIO_BUTTON,
  SAMPLE_AUDIO_ERROR,
  SAMPLE_AUDIO_ERROR_RECOVERY,
  SAMPLE_AUDIO_LABEL,
  SAMPLE_AUDIO_LOADING,
  SAMPLE_AUDIO_NOTE,
  SYNTHETIC_CASE_BUTTON,
  SYNTHETIC_CASE_NOTE,
} from '../content/claims';

export interface AudioInputMeta {
  /** Set when the analysis is of the public sample recording, not the user's own audio. */
  sampleLabel?: string;
}

export interface AudioInputProps {
  /** Called with the finished analysis when the user continues. */
  onComplete: (analysis: AudioAnalysis, meta?: AudioInputMeta) => void;
  /** Loads the synthetic example case (Dana). */
  onUseLabeledSample: () => void;
  /** Continue without a recording. */
  onSkip?: () => void;
  onBack?: () => void;
  onConsent?: (record: ConsentRecord) => void;
  /** Where the sample file is served from (tests override). */
  sampleUrl?: string;
}

const defaultSampleUrl = () => `${import.meta.env.BASE_URL ?? '/'}sample-audio/esc50-sample.wav`;

export function AudioInput({ onComplete, onUseLabeledSample, onSkip, onBack, onConsent, sampleUrl }: AudioInputProps) {
  const [granted, setGranted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sampleError, setSampleError] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start, cancel, reset } = useAnalysis();
  const busy = state.phase === 'decoding' || state.phase === 'analyzing' || fetching;

  const pick = (file: File | undefined) => {
    if (!file) return;
    setIsSample(false);
    setSampleError(false);
    void start(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) pick(e.dataTransfer.files[0]);
  };

  /** Fetches the bundled sample and sends it through the same decode + worker pipeline as an upload. */
  const analyzeSample = async () => {
    setSampleError(false);
    setIsSample(true);
    setFetching(true);
    try {
      const res = await fetch(sampleUrl ?? defaultSampleUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], 'esc50-sample.wav', { type: 'audio/wav' });
      setFetching(false);
      await start(file);
    } catch {
      setFetching(false);
      setIsSample(false);
      setSampleError(true);
    }
  };

  const showPicker = state.phase === 'idle' || state.phase === 'cancelled' || state.phase === 'error';

  return (
    <section aria-labelledby="audio-h">
      <h2 id="audio-h">Add a sleep recording (optional)</h2>
      <p>A recording is optional. Without one, your answers still give you a summary to bring to a clinician, and the missing recording is listed as missing information.</p>

      <div className="path-grid">
        <div className="card path path-primary">
          <h3>Try a sample</h3>
          <p>{SAMPLE_AUDIO_NOTE}</p>
          <p className="actions">
            <button type="button" className={state.phase === 'done' ? 'btn btn-secondary' : 'btn'} onClick={() => void analyzeSample()} disabled={busy}>
              {SAMPLE_AUDIO_BUTTON}
            </button>
          </p>
          <p className="hint">{SAMPLE_AUDIO_LABEL}</p>
          <hr />
          <p>{SYNTHETIC_CASE_NOTE}</p>
          <p className="actions">
            <button type="button" className="btn btn-secondary" onClick={onUseLabeledSample} disabled={busy}>
              {SYNTHETIC_CASE_BUTTON}
            </button>
          </p>
        </div>
        <div className="card path">
          <h3>{OWN_RECORDING_HEADING}</h3>
          <p>For best results, record 10 to 20 minutes of sleep sounds. Recordings must be 30 seconds to 20 minutes and under 100 MB.</p>
          <ConsentGate
            title="Your audio stays on this device"
            description="Analysis runs locally in your browser. Your audio is never uploaded or stored, and it is discarded when you leave this page."
            checkboxLabel="I understand and want to analyze a recording here"
            granted={granted}
            onChange={(g) => {
              setGranted(g);
              onConsent?.({ purpose: 'audio-local-analysis', granted: g, at: new Date().toISOString() });
            }}
          >
            {showPicker && !fetching ? (
              <div
                className={`dropzone${dragging ? ' dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <p>Drag an audio file here, or choose one:</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm"
                  aria-label="Choose an audio file"
                  onChange={(e) => {
                    pick(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : null}
          </ConsentGate>
        </div>
      </div>

      {state.phase === 'cancelled' && <p role="status">Analysis cancelled. Nothing was kept.</p>}

      {busy && (
        <>
          <LoadingState
            label={fetching ? SAMPLE_AUDIO_LOADING : state.phase === 'decoding' ? 'Reading the audio file...' : `Analyzing locally... ${Math.round(state.progress * 100)}%`}
            progress={!fetching && state.phase === 'analyzing' ? state.progress : undefined}
          />
          {!fetching && (
            <button type="button" className="btn btn-secondary" onClick={cancel}>
              Cancel
            </button>
          )}
        </>
      )}

      {sampleError && <ErrorState title={SAMPLE_AUDIO_ERROR} message={SAMPLE_AUDIO_ERROR_RECOVERY} actionLabel="Try the sample again" onAction={() => void analyzeSample()} />}

      {state.phase === 'error' && state.error && (
        <ErrorState
          title="This recording could not be used"
          message={`${state.error.message} ${state.error.recovery}`}
          actionLabel="Try another file"
          onAction={() => {
            reset();
            setIsSample(false);
            inputRef.current?.click();
          }}
        />
      )}

      {state.phase === 'done' && state.analysis && (
        <div>
          <h3>Recording check</h3>
          {isSample && (
            <p>
              <SourceBadge kind="sample" /> <strong>{SAMPLE_AUDIO_LABEL}</strong>
            </p>
          )}
          <QualityPanel quality={state.analysis.quality} />
          {state.analysis.quality.verdict === 'unusable' ? (
            <ErrorState
              title="This recording is not usable"
              message="You can try another recording or use the sample."
              actionLabel="Use another file"
              onAction={reset}
            />
          ) : (
            <>
              <LoudnessChart loudness={state.analysis.loudness} quietGaps={state.analysis.quietGaps} windows={state.analysis.windows} />
              <p>Quiet periods found: {state.analysis.quietGaps.length}. These come from a simple loudness threshold and are not a breathing measurement.</p>
            </>
          )}
          <p className="actions">
            <button type="button" className="btn" onClick={() => onComplete(state.analysis as AudioAnalysis, isSample ? { sampleLabel: SAMPLE_AUDIO_LABEL } : undefined)}>
              Continue to results
            </button>
          </p>
        </div>
      )}

      <div className="actions nav-actions">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
        {onSkip && (
          <button type="button" className="btn btn-secondary" onClick={onSkip}>
            Skip the recording
          </button>
        )}
      </div>
    </section>
  );
}
