import { useState } from 'react';
import {
  DIFFERENT_HEADING,
  DIFFERENT_INTRO,
  DIFFERENT_POINTS,
  DIFFERENT_SOURCES,
  PATHWAY_HEADING,
  PATHWAY_INTRO,
  PATHWAY_STEPS,
  QUESTIONS_COST_LINE,
  QUESTIONS_HEADING,
  QUESTIONS_LIST,
  QUESTIONS_SOURCE_NOTE,
  REMINDER_WEB_NOTE,
  SCOPE_ADULTS,
  SCOPE_CHILDREN,
  SCOPE_HEADING,
  SCOPE_PREGNANCY,
  SCOPE_SOURCES,
  SCRIPT_BASIS_NOTE,
  SCRIPT_BUILT_NOTE,
  SCRIPT_COPIED,
  SCRIPT_COPY,
  SCRIPT_COPY_FAILED,
  SCRIPT_EMPTY_NOTE,
  SCRIPT_HEADING,
  SCRIPT_LABEL,
  TRACKER_HEADING,
  TRACKER_ITEMS,
  TRACKER_LABEL,
  TRACKER_NOTE,
  TRACKER_SOURCE,
  TREATMENTS_HEADING,
  TREATMENTS_LABEL,
  TREATMENTS_NOTE,
  TREATMENT_OPTIONS,
  type PathwaySource,
} from '../content/pathway';
import { sanitizeTrackerTicks, toggleTick } from '../mobileLogic/followThrough';
import { buildClinicianScript, scriptToText } from '../mobileLogic/pathwayScript';
import { useSession } from '../state/session';

/** Prefixed "sleepsmooth." so "Delete my data" removes it with everything else. */
export const FOLLOW_THROUGH_KEY = 'sleepsmooth.followthrough.v1';

function readTicks(): string[] {
  try {
    const raw = sessionStorage.getItem(FOLLOW_THROUGH_KEY);
    return sanitizeTrackerTicks(raw ? (JSON.parse(raw) as unknown) : []);
  } catch {
    return [];
  }
}

function Sources({ list }: { list: PathwaySource[] }) {
  return (
    <p className="hint">
      Sources:{' '}
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 ? '; ' : ''}
          <a href={s.url} target="_blank" rel="noreferrer noopener">
            {s.label}
          </a>
        </span>
      ))}
    </p>
  );
}

function Section({ title, label, children }: { title: string; label?: string; children: React.ReactNode }) {
  return (
    <details className="limits-details">
      <summary>{title}</summary>
      {label ? <p><strong>{label}</strong></p> : null}
      {children}
    </details>
  );
}

function ScriptBlock() {
  const s = useSession();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const a = s.audio;
  const recorded = a && a.status === 'done' && a.quality.verdict !== 'unusable' ? 1 : 0;
  const snore = recorded === 1 && a?.modelApplicable && a.windows.some((w) => w.snoreLike) ? 1 : 0;
  const built = buildClinicianScript({
    symptoms: s.symptoms,
    redFlag: s.redFlag,
    questionnaireAnswered: Object.keys(s.answers).length > 0,
    recordedNights: recorded,
    snoreLikeNights: snore,
    sample: s.isSynthetic || a?.isSynthetic === true,
  });
  const text = scriptToText(built);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return (
    <>
      {built.factCount === 0 ? <p className="hint">{SCRIPT_EMPTY_NOTE}</p> : <p className="hint">{SCRIPT_BUILT_NOTE}</p>}
      <blockquote className="script-text" data-testid="clinician-script">
        {built.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </blockquote>
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={copy}>
          {SCRIPT_COPY}
        </button>
      </div>
      <p role="status" className="hint">
        {status === 'copied' ? SCRIPT_COPIED : status === 'failed' ? SCRIPT_COPY_FAILED : ''}
      </p>
      <p className="hint">{SCRIPT_BASIS_NOTE}</p>
    </>
  );
}

function Tracker() {
  const consented = useSession().consent?.granted === true;
  const [ticked, setTicked] = useState<string[]>(() => (consented ? readTicks() : []));
  const toggle = (id: string) => {
    const next = toggleTick(ticked, id);
    setTicked(next);
    if (!consented) return;
    try {
      sessionStorage.setItem(FOLLOW_THROUGH_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: keep in memory only
    }
  };
  return (
    <>
      <p>{TRACKER_NOTE}</p>
      <Sources list={[TRACKER_SOURCE]} />
      <fieldset className="check-group">
        <legend>Optional steps</legend>
        {TRACKER_ITEMS.map((t) => (
          <label key={t.id} className="choice">
            <input type="checkbox" checked={ticked.includes(t.id)} onChange={() => toggle(t.id)} />
            <span>{t.label}</span>
          </label>
        ))}
      </fieldset>
      <p className="hint">{REMINDER_WEB_NOTE}</p>
    </>
  );
}

/** Pathway guide for the web Next steps page. One heading per section; detail sits behind a tap. */
export function PathwayGuide() {
  return (
    <div className="pathway-guide">
      <Section title={PATHWAY_HEADING}>
        <p>{PATHWAY_INTRO}</p>
        <ol className="pathway-steps">
          {PATHWAY_STEPS.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong>
              <p>{p.body}</p>
              {p.source ? <Sources list={[p.source]} /> : null}
            </li>
          ))}
        </ol>
      </Section>
      <Section title={TREATMENTS_HEADING} label={TREATMENTS_LABEL}>
        <p>{TREATMENTS_NOTE}</p>
        <ul>
          {TREATMENT_OPTIONS.map((t) => (
            <li key={t.id}>
              <strong>{t.name}.</strong> {t.body}
              <Sources list={[t.source]} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title={QUESTIONS_HEADING}>
        <ul>
          {QUESTIONS_LIST.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p><strong>{QUESTIONS_COST_LINE}</strong></p>
        <p className="hint">{QUESTIONS_SOURCE_NOTE}</p>
      </Section>
      <Section title={SCRIPT_HEADING} label={SCRIPT_LABEL}>
        <ScriptBlock />
      </Section>
      <Section title={TRACKER_HEADING} label={TRACKER_LABEL}>
        <Tracker />
      </Section>
      <Section title={SCOPE_HEADING}>
        <p>{SCOPE_ADULTS}</p>
        <p>{SCOPE_CHILDREN}</p>
        <p>{SCOPE_PREGNANCY}</p>
        <Sources list={SCOPE_SOURCES} />
      </Section>
      <Section title={DIFFERENT_HEADING}>
        <p>{DIFFERENT_INTRO}</p>
        <ul>
          {DIFFERENT_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Sources list={DIFFERENT_SOURCES} />
      </Section>
    </div>
  );
}
