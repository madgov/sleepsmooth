import { CONSENT_HISTORY_EMPTY, CONSENT_HISTORY_NOTE, CONSENT_HISTORY_TITLE, CONSENT_PURPOSE_LABELS, CONSENT_STATUS_LABELS, consentHistoryForDisplay } from '@core/consent/history';
import type { ConsentHistoryRecord } from '@core/types/consent';
import { InsetGroup, ListRow } from './InsetGroup';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Append-only consent history, newest first. Read-only: a change is made by agreeing or withdrawing, which adds a line. */
export function ConsentHistoryList({ history }: { history: readonly ConsentHistoryRecord[] }) {
  const rows = consentHistoryForDisplay(history);
  return (
    <InsetGroup header={CONSENT_HISTORY_TITLE} footer={rows.length === 0 ? `${CONSENT_HISTORY_EMPTY} ${CONSENT_HISTORY_NOTE}` : CONSENT_HISTORY_NOTE}>
      {rows.map((r) => (
        <ListRow
          key={r.id}
          title={`${CONSENT_STATUS_LABELS[r.status]}: ${CONSENT_PURPOSE_LABELS[r.purpose]}`}
          subtitle={`${when(r.at)}. Wording version ${r.version}.`}
          leading={r.status === 'granted' ? 'checkmark.circle' : 'xmark.circle'}
          testID={`consent-record-${r.id}`}
        />
      ))}
    </InsetGroup>
  );
}
