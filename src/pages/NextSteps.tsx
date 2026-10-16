import { useState } from 'react';
import { Disclaimer } from '../components';
import { useSession } from '../state/session';
import { PathwayGuide } from './PathwayGuide';
import {
  DISCLAIMER_SEEK_CARE,
  NEXT_STEPS_DROWSY_HEADING,
  NEXT_STEPS_GROUPS,
  NEXT_STEPS_INTRO,
  NEXT_STEPS_NOT_REASSURANCE,
  NEXT_STEPS_PROGRESS,
  NEXT_STEPS_MEMORY_NOTE,
  NEXT_STEPS_STORAGE_NOTE,
  RED_FLAG_NOTE,
} from '../content/claims';

/** Prefixed "sleepsmooth." so "Delete my data" removes it with everything else. */
export const NEXT_STEPS_KEY = 'sleepsmooth.nextsteps.v1';
const ALL_IDS = NEXT_STEPS_GROUPS.flatMap((g) => g.items.map((i) => i.id));

function readTicks(): string[] {
  try {
    const raw = sessionStorage.getItem(NEXT_STEPS_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ALL_IDS.includes(x)) : [];
  } catch {
    return [];
  }
}

export function NextSteps({ onBack }: { onBack: () => void }) {
  const consented = useSession().consent?.granted === true;
  // Ticks are stored only with the session-storage consent; otherwise they live in memory.
  const [ticked, setTicked] = useState<string[]>(() => (consented ? readTicks() : []));

  const toggle = (id: string) => {
    const next = ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id];
    setTicked(next);
    if (!consented) return;
    try {
      sessionStorage.setItem(NEXT_STEPS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: keep ticks in memory only
    }
  };

  return (
    <section aria-labelledby="ns-h">
      <h2 id="ns-h">Next steps</h2>
      <p>{NEXT_STEPS_INTRO}</p>
      <p role="status" className="hint">
        {NEXT_STEPS_PROGRESS(ticked.length, ALL_IDS.length)}. {consented ? NEXT_STEPS_STORAGE_NOTE : NEXT_STEPS_MEMORY_NOTE}
      </p>
      {NEXT_STEPS_GROUPS.map((g) => (
        <fieldset key={g.id} className="check-group">
          <legend>{g.title}</legend>
          {g.items.map((i) => (
            <label key={i.id} className="choice">
              <input type="checkbox" checked={ticked.includes(i.id)} onChange={() => toggle(i.id)} />
              <span>{i.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="card card-conflict">
        <h3>{NEXT_STEPS_DROWSY_HEADING}</h3>
        <p>{RED_FLAG_NOTE}</p>
      </div>
      <PathwayGuide />
      <p>{NEXT_STEPS_NOT_REASSURANCE}</p>
      <p>{DISCLAIMER_SEEK_CARE}</p>
      <Disclaimer />
      <div className="actions nav-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
