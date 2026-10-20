// ConsentRecord history: an append-only list. A change of mind adds a record; nothing is edited or removed
// except by "Delete my data", which clears the whole list.

export type ConsentPurpose = 'audio-local-analysis' | 'session-storage' | 'overnight-local-capture';
export type ConsentStatus = 'granted' | 'withdrawn';

export interface ConsentHistoryRecord {
  id: string;
  purpose: ConsentPurpose;
  /** Version of the consent wording the person saw. */
  version: string;
  status: ConsentStatus;
  /** ISO timestamp. */
  at: string;
}
