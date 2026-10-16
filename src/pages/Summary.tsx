import { useState } from 'react';
import { DemoBanner, LimitsPanel, SourceBadge, sourceLabel } from '../components';
import {
  NOSAS_CITATION,
  SAMPLE_AUDIO_ATTRIBUTION,
  SUMMARY_EDITED_MARKER,
  SUMMARY_GENERATED_NOTE,
  SUMMARY_PRINT_BUTTON,
  SUMMARY_PRINT_NOT_DIAGNOSIS,
  SUMMARY_PRINT_SOURCES,
  SUMMARY_PRINT_TITLE,
  SUMMARY_REGENERATE_CONFIRM,
  SYNTHETIC_LABEL,
} from '../content/claims';
import { generateCareSummary, regenerateSummary } from '../report/generate';
import { useDerived } from '../state/derived';
import { useSession } from '../state/session';

export function Summary({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const s = useSession();
  const { input, reportInput } = useDerived();
  const { audioLabel, audio } = s;
  const [now, setNow] = useState(() => new Date().toISOString());
  const [confirming, setConfirming] = useState(false);

  const fresh = generateCareSummary(reportInput(now));
  const edited = s.editedIds;
  // Only sections the user edited come from storage. Every other section is rebuilt from the current
  // answers and recording, so a saved summary can never show stale guidance after the inputs change.
  const summary = s.summary
    ? { ...s.summary, sections: fresh.sections.map((f) => (edited.includes(f.id) ? (s.summary?.sections.find((x) => x.id === f.id) ?? f) : f)) }
    : fresh;

  const edit = (id: string, text: string) => {
    const sections = summary.sections.map((x) => (x.id === id ? { ...x, text } : x));
    s.setSummary({ ...summary, sections, userEdited: true }, edited.includes(id) ? edited : [...edited, id]);
  };

  const regenerate = (overwrite: boolean) => {
    const t = new Date().toISOString();
    setNow(t);
    const f = generateCareSummary(reportInput(t));
    const r = regenerateSummary(summary, f, edited, overwrite);
    s.setSummary(r.editedIds.length === 0 ? null : r.summary, r.editedIds);
    setConfirming(false);
  };

  const when = new Date(summary.generatedAt);
  const dateText = Number.isNaN(when.getTime()) ? summary.generatedAt : when.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const sampleAudioUsed = Boolean(audio && audioLabel && !input.isSynthetic);

  return (
    <section aria-labelledby="sum-h">
      <div className="no-print">
        <DemoBanner isSynthetic={input.isSynthetic} />
        <h2 id="sum-h">Summary to discuss with a clinician</h2>
        <p>{SUMMARY_GENERATED_NOTE}</p>
        {sampleAudioUsed && (
          <p>
            <SourceBadge kind="sample" /> <strong>{audioLabel}.</strong> The recording section below describes the sample, not your sleep.
          </p>
        )}
        {summary.sections.map((sec) => (
          <div key={sec.id} className="summary-section">
            <h3>
              <label htmlFor={`sec-${sec.id}`}>{sec.title}</label>
            </h3>
            <p>
              <SourceBadge kind={sec.source} /> {sec.isSynthetic && <SourceBadge kind="sample" />} {edited.includes(sec.id) && <em>{SUMMARY_EDITED_MARKER}</em>}
            </p>
            <textarea id={`sec-${sec.id}`} rows={Math.min(14, sec.text.split('\n').length + 1)} value={sec.text} onChange={(e) => edit(sec.id, e.target.value)} />
          </div>
        ))}
        <LimitsPanel />
        <p>Generated {dateText}</p>
        {confirming ? (
          <div role="alertdialog" aria-label="Confirm regenerate" className="card">
            <p>{SUMMARY_REGENERATE_CONFIRM}</p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => regenerate(true)}>
                Replace my edits
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => regenerate(false)}>
                Keep my edits
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => (edited.length > 0 ? setConfirming(true) : regenerate(false))}>
              Regenerate summary
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              {SUMMARY_PRINT_BUTTON}
            </button>
          </div>
        )}
        <div className="actions nav-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" className="btn" onClick={onNext}>
            Next steps
          </button>
        </div>
      </div>

      {/* Print layout: plain text of the current (possibly edited) sections. Hidden on screen. */}
      <article className="print-only" aria-hidden="true" data-testid="print-summary">
        <p className="print-title">{SUMMARY_PRINT_TITLE}</p>
        <p className="print-meta">Date: {dateText}</p>
        <p className="print-strong">{SUMMARY_PRINT_NOT_DIAGNOSIS}</p>
        {input.isSynthetic && <p className="print-strong">{SYNTHETIC_LABEL}: this summary was made from an example case, not from a real person.</p>}
        {sampleAudioUsed && <p className="print-strong">{audioLabel}. The recording section describes the sample, not the user.</p>}
        {summary.sections.map((sec) => (
          <section key={sec.id} className="print-section">
            <p className="print-h">{sec.title}</p>
            <p className="print-meta">Source: {sourceLabel(sec.source)}</p>
            <p className="print-text">{sec.text}</p>
          </section>
        ))}
        <section className="print-section">
          <p className="print-h">{SUMMARY_PRINT_SOURCES}</p>
          <p className="print-text">{NOSAS_CITATION}</p>
          {sampleAudioUsed && <p className="print-text">{SAMPLE_AUDIO_ATTRIBUTION}</p>}
        </section>
      </article>
    </section>
  );
}
