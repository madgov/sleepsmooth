import { useEffect, useId, useRef, useState } from 'react';
import {
  WEARABLE_EMPTY,
  WEARABLE_METRIC_LABELS,
  WEARABLE_NEUTRAL_LINE,
  WEARABLE_OPTIONAL_NOTE,
  WEARABLE_SOURCE_LABEL,
  WEARABLE_TITLE,
  WEARABLE_UNITS_NOTE,
} from '../content/wearable';
import type { WearableMetric, WearableObservation } from '../types/wearable';
import {
  METRIC_SPEC,
  WEARABLE_METRICS,
  addObservations,
  draftFromObservation,
  emptyWearableDraft,
  observationLine,
  removeObservation,
  replaceObservation,
  validateDraft,
  validateEdit,
  type WearableDraft,
  type WearableErrors,
  localDateISO,
} from '../wearable/entries';

export interface WearablePanelProps {
  entries: readonly WearableObservation[];
  onChange: (next: WearableObservation[]) => void;
}

/** Optional, collapsed by default. Numbers typed in from a wearable: add, edit, delete. Never scored, coloured or interpreted. */
export function WearablePanel({ entries, onChange }: WearablePanelProps) {
  const id = useId();
  const [draft, setDraft] = useState<WearableDraft>(emptyWearableDraft());
  const [editing, setEditing] = useState<WearableObservation | null>(null);
  const [errors, setErrors] = useState<WearableErrors>({});
  const [status, setStatus] = useState('');
  const form = useRef<HTMLFormElement>(null);
  // Opening an edit moves focus to the form so the person sees it (the list can be far below).
  useEffect(() => {
    if (editing) {
      const input = form.current?.querySelector<HTMLInputElement>('input[id$="-' + editing.metric + '"]');
      input?.focus();
      input?.scrollIntoView({ block: 'center' });
    }
  }, [editing]);
  const metrics: readonly WearableMetric[] = editing ? [editing.metric] : WEARABLE_METRICS;
  const reset = () => {
    setDraft(emptyWearableDraft());
    setEditing(null);
    setErrors({});
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const r = validateEdit(editing, draft, localDateISO(new Date()));
      if (!r.ok) return setErrors(r.errors);
      onChange(replaceObservation(entries, r.observation));
      setStatus('Changes saved.');
    } else {
      const r = validateDraft(draft, new Date().toISOString());
      if (!r.ok) return setErrors(r.errors);
      onChange(addObservations(entries, r.observations));
      setStatus('Readings added.');
    }
    reset();
  };
  const field = (key: string, label: string, value: string, set: (v: string) => void, opts: { error?: string; hint?: string; inputMode?: 'decimal' | 'text'; placeholder?: string } = {}) => (
    <div className="field" key={key}>
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <input
        id={`${id}-${key}`}
        type="text"
        inputMode={opts.inputMode ?? 'text'}
        value={value}
        placeholder={opts.placeholder ?? 'Optional'}
        aria-invalid={opts.error ? true : undefined}
        aria-describedby={opts.error ? `${id}-${key}-e` : undefined}
        onChange={(e) => set(e.target.value)}
      />
      {opts.hint && <span className="hint">{opts.hint}</span>}
      {opts.error && (
        <span id={`${id}-${key}-e`} className="field-error" role="alert">
          {opts.error}
        </span>
      )}
    </div>
  );

  return (
    <details className="limits-details wearable-panel">
      <summary>{WEARABLE_TITLE} (optional)</summary>
      <p className="wearable-label">{WEARABLE_SOURCE_LABEL}</p>
      <p className="hint">{WEARABLE_NEUTRAL_LINE}</p>
      <form ref={form} onSubmit={save} noValidate aria-label={editing ? `Edit ${WEARABLE_METRIC_LABELS[editing.metric]}` : 'Add wearable readings'}>
        <p className="hint">{WEARABLE_OPTIONAL_NOTE}</p>
        {field('source', 'Device or app', draft.source, (v) => setDraft({ ...draft, source: v }), { error: errors.source })}
        {field('date', 'Night it is about (YYYY-MM-DD)', draft.forDate, (v) => setDraft({ ...draft, forDate: v }), { error: errors.forDate })}
        {metrics.map((m) =>
          field(m, `${WEARABLE_METRIC_LABELS[m]}${m === 'breathing-disturbances' ? '' : ` (${METRIC_SPEC[m].unit})`}`, draft.values[m] ?? '', (v) => setDraft({ ...draft, values: { ...draft.values, [m]: v } }), { inputMode: 'decimal', error: errors[m] }),
        )}
        {metrics.includes('breathing-disturbances') && field('label', 'Name your device app uses for it', draft.deviceLabel, (v) => setDraft({ ...draft, deviceLabel: v }), { error: errors.deviceLabel })}
        <p className="hint">{WEARABLE_UNITS_NOTE}</p>
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn">
            {editing ? 'Save changes' : 'Add readings'}
          </button>
          {editing && (
            <>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onChange(removeObservation(entries, editing.id));
                  setStatus('Reading deleted.');
                  reset();
                }}
              >
                Delete this reading
              </button>
            </>
          )}
        </div>
      </form>
      <p role="status" className="hint">
        {status}
      </p>
      <h4>Your readings</h4>
      {entries.length === 0 ? (
        <p className="hint">{WEARABLE_EMPTY}</p>
      ) : (
        <ul className="wearable-list">
          {entries.map((o) => (
            <li key={o.id}>
              <span>{observationLine(o)}</span>
              <span className="wearable-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditing(o);
                    setDraft(draftFromObservation(o));
                    setErrors({});
                    setStatus('');
                  }}
                  aria-label={`Edit ${observationLine(o)}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-danger-quiet"
                  onClick={() => {
                    onChange(removeObservation(entries, o.id));
                    setStatus('Reading deleted.');
                    if (editing?.id === o.id) reset();
                  }}
                  aria-label={`Delete ${observationLine(o)}`}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{WEARABLE_NEUTRAL_LINE}</p>
    </details>
  );
}
