import { DISCUSS_HEADING, DISCUSS_INTRO, DISCUSS_ITEMS, DISCUSS_OPTIONAL, DISCUSS_SOURCE_LINE } from '../content/claims';
import { discussKey, type DiscussAnswers } from '../questionnaire/discussItems';

/** Optional, unscored checklist. Ticking only adds a user-reported line to the clinician summary. */
export function DiscussChecklist({ answers, onToggle }: { answers: DiscussAnswers; onToggle: (id: string, on: boolean) => void }) {
  return (
    <fieldset className="discuss-list" data-testid="discuss-checklist">
      <legend>
        {DISCUSS_HEADING} ({DISCUSS_OPTIONAL.toLowerCase()})
      </legend>
      <p>{DISCUSS_INTRO}</p>
      {DISCUSS_ITEMS.map((it) => (
        <label key={it.id} className="choice">
          <input type="checkbox" checked={answers[discussKey(it.id)] === true} onChange={(e) => onToggle(it.id, e.target.checked)} /> {it.text}
          <span className="discuss-src">{it.source}</span>
        </label>
      ))}
      <p className="card-citation">{DISCUSS_SOURCE_LINE}</p>
    </fieldset>
  );
}
