import type { ReactNode } from 'react';
import {
  AUDIO_SLOT_EMPTY,
  DISCLAIMER_AUDIO,
  DISCLAIMER_NOT_DIAGNOSIS,
  RESULTS_AUDIO_DETAILS_HEADING,
  RESULTS_DETAILS_HEADING,
  RESULTS_EMPTY_ACTION,
  RESULTS_EMPTY_MESSAGE,
  RESULTS_EMPTY_TITLE,
  MODEL_CARD_HEADING,
  MODEL_CARD_INTENDED,
  MODEL_CARD_NOT_FOR,
  MODEL_CARD_OTHER_LIMITS,
  MODEL_CARD_PATH,
  MODEL_CARD_PHONE_WEAKNESS,
  MODEL_NOT_APPLICABLE_RESULT,
  NO_MODEL_LINE,
  SNORE_NONE_ASSESSABLE_LINE,
  SNORE_NOT_APNEA_LINE,
  modelVersionLine,
  snoreWindowsLine,
  tooQuietLine,
} from '../content/claims';
import { loadShippedModel } from '../audio/model/infer';
import { isModelNotApplicable } from '../evidence/audioState';
import type { AudioAnalysis } from '../types/audio';
import { LimitsPanel, LoudnessChart, QualityPanel, ConflictCard, DemoBanner, Disclaimer, EmptyState, EvidenceCard, SourceBadge } from '../components';
import { useSession } from '../state/session';
import { useDerived } from '../state/derived';
import type { Source } from '../types/evidence';

const COLUMNS: { title: string; id: string; sources: Source[]; empty: string }[] = [
  { title: 'User-reported', id: 'col-user', sources: ['user-reported'], empty: 'Nothing was reported yet.' },
  { title: 'Audio observations', id: 'col-audio', sources: ['audio-observation', 'wearable'], empty: 'No recording was analyzed.' },
  { title: 'Missing information', id: 'col-missing', sources: ['missing'], empty: 'Nothing else was flagged as missing.' },
];

/** Snore-pattern results for a finished analysis (M6). Counts and words only: no scores, no percentages. */
export function SnoreResults({ audio, modelShipped }: { audio: AudioAnalysis; modelShipped: boolean }) {
  const notApplicable = isModelNotApplicable(audio);
  const noModel = !modelShipped || audio.modelVersion === null;
  const snoreLike = audio.windows.filter((w) => w.snoreLike).length;
  return (
    <section aria-label="Snore-pattern analysis" data-testid="snore-results">
      <h4>Snore-pattern analysis</h4>
      {noModel ? (
        <p>
          {NO_MODEL_LINE} Quality, loudness and quiet periods are shown above.
        </p>
      ) : notApplicable ? (
        <p>{MODEL_NOT_APPLICABLE_RESULT}</p>
      ) : (
        <>
          <p>{audio.windows.length === 0 ? SNORE_NONE_ASSESSABLE_LINE : snoreWindowsLine(snoreLike, audio.windows.length)}</p>
          <p>{tooQuietLine(audio.quietWindowCount)}</p>
        </>
      )}
      {audio.modelVersion && <p>{modelVersionLine(audio.modelVersion)}</p>}
      <p>
        <strong>{SNORE_NOT_APNEA_LINE}</strong>
      </p>
      {!noModel && (
        <details>
          <summary>{MODEL_CARD_HEADING}</summary>
          <ul>
            <li>{MODEL_CARD_INTENDED}</li>
            <li>{MODEL_CARD_NOT_FOR}</li>
            <li>{MODEL_CARD_PHONE_WEAKNESS}</li>
            <li>{MODEL_CARD_OTHER_LIMITS}</li>
          </ul>
          <p>
            Tested numbers, the small size of the test and what has not been tested yet are on the <a href="#/model-card">model card</a>.
          </p>
          <p>Full details: {MODEL_CARD_PATH} in the project files.</p>
        </details>
      )}
    </section>
  );
}

/**
 * Hierarchy: headline conclusion, conflict card, three evidence columns by source, recording details,
 * then the model and limits section (collapsed).
 */
export function Results({ onNext, onBack, onEdit, audioSlot }: { onNext: () => void; onBack: () => void; onEdit?: () => void; audioSlot?: ReactNode }) {
  const { evidence, input } = useDerived();
  const { audio, audioLabel } = useSession();
  const guidance = evidence.items.filter((i) => i.source === 'app-guidance');
  // Limitations that appear on more than one card are shown once, not repeated on every card.
  const counts = new Map<string, number>();
  for (const i of evidence.items) for (const l of new Set(i.limitations)) counts.set(l, (counts.get(l) ?? 0) + 1);
  const shared = [...counts].filter(([, n]) => n > 1).map(([l]) => l);
  const nothingYet = evidence.conclusion === 'not-enough-information' && !audio;
  const defaultSlot =
    audio && audio.status === 'done' ? (
      <>
        <QualityPanel quality={audio.quality} />
        <LoudnessChart loudness={audio.loudness} quietGaps={audio.quietGaps} windows={audio.windows} />
        <SnoreResults audio={audio} modelShipped={loadShippedModel() !== null} />
      </>
    ) : undefined;
  return (
    <section aria-labelledby="res-h">
      <DemoBanner isSynthetic={input.isSynthetic} />
      <h2 id="res-h">What the evidence shows</h2>

      <div className={`headline ${evidence.conclusion === 'discuss-with-clinician' ? 'headline-discuss' : 'headline-neutral'}`} role="status">
        <p className="headline-text">{evidence.headline}</p>
        <p>{DISCLAIMER_NOT_DIAGNOSIS}</p>
      </div>

      {nothingYet && <EmptyState title={RESULTS_EMPTY_TITLE} message={RESULTS_EMPTY_MESSAGE} actionLabel={onEdit ? RESULTS_EMPTY_ACTION : undefined} onAction={onEdit} />}

      {evidence.redFlags.map((r) => (
        <ConflictCard key={r} title="Please talk to a clinician promptly" text={r} />
      ))}
      {evidence.conflicts.map((c) => (
        <ConflictCard key={c} text={c} />
      ))}

      {audio && audioLabel && !input.isSynthetic && (
        <p className="sample-note">
          <SourceBadge kind="sample" /> <strong>{audioLabel}.</strong> This is not your recording, and it says nothing about your sleep.
        </p>
      )}

      {shared.length > 0 && (
        <div className="shared-limits" role="note" aria-label="Limits that apply to every item below">
          <p className="shared-limits-title">Limits that apply to everything below</p>
          <ul>
            {shared.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="evidence-columns">
        {COLUMNS.map((col) => {
          const items = evidence.items.filter((i) => col.sources.includes(i.source));
          return (
            <section key={col.id} className="evidence-col" aria-labelledby={col.id}>
              <h3 id={col.id}>{col.title}</h3>
              {items.length === 0 ? <p className="hint">{col.empty}</p> : items.map((i) => <EvidenceCard key={i.id} item={i} hideLimitations={shared} />)}
            </section>
          );
        })}
      </div>

      <div data-slot="audio-evidence" className="audio-details">
        <h3>{RESULTS_AUDIO_DETAILS_HEADING}</h3>
        {audioSlot ?? defaultSlot ?? <p>{AUDIO_SLOT_EMPTY}</p>}
        <p>{DISCLAIMER_AUDIO}</p>
      </div>

      <LimitsPanel />

      <details className="limits-details">
        <summary>{RESULTS_DETAILS_HEADING}</summary>
        {guidance.map((i) => (
          <EvidenceCard key={i.id} item={i} hideLimitations={shared} />
        ))}
        <h3>Uncertainty</h3>
        <ul>
          {evidence.uncertaintyNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <Disclaimer />
      </details>

      <div className="actions nav-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn" onClick={onNext}>
          Create my summary
        </button>
      </div>
    </section>
  );
}
