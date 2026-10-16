import { LIMITS_PANEL_ITEMS, LIMITS_PANEL_MORE, LIMITS_PANEL_SOURCES, LIMITS_PANEL_TITLE, LIMITS_PANEL_WATCH_LINE } from '../content/claims';

/** Calm, neutral "what this cannot tell you" panel. Same wording as the phone app. Never coloured as success. */
export function LimitsPanel() {
  return (
    <aside className="limits-panel no-print" aria-labelledby="limits-panel-h" data-testid="limits-panel">
      <h3 id="limits-panel-h">{LIMITS_PANEL_TITLE}</h3>
      <ul>
        {LIMITS_PANEL_ITEMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <details>
        <summary>{LIMITS_PANEL_MORE}</summary>
        <p>{LIMITS_PANEL_WATCH_LINE}</p>
        <p className="card-citation">{LIMITS_PANEL_SOURCES}</p>
      </details>
    </aside>
  );
}
