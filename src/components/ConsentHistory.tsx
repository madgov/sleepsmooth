import { CONSENT_HISTORY_EMPTY, CONSENT_HISTORY_NOTE, CONSENT_HISTORY_TITLE, CONSENT_PURPOSE_LABELS, CONSENT_STATUS_LABELS, consentHistoryForDisplay } from '../consent/history';
import type { ConsentHistoryRecord } from '../types/consent';

/** Append-only list of consent choices, newest first. Read-only. */
export function ConsentHistory({ history }: { history: readonly ConsentHistoryRecord[] }) {
  const rows = consentHistoryForDisplay(history);
  return (
    <details className="consent-history">
      <summary>{CONSENT_HISTORY_TITLE}</summary>
      {rows.length === 0 ? (
        <p className="hint">{CONSENT_HISTORY_EMPTY}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{CONSENT_STATUS_LABELS[r.status]}:</strong> {CONSENT_PURPOSE_LABELS[r.purpose]} <time dateTime={r.at}>{new Date(r.at).toLocaleString('en-US')}</time> (wording version {r.version})
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{CONSENT_HISTORY_NOTE}</p>
    </details>
  );
}
