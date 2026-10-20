import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ConsentHistory } from './ConsentHistory';
import type { ConsentHistoryRecord } from '../types/consent';
import { DELETE_DATA_LABEL, FOOTER_MODEL_CARD, FOOTER_SOURCES, FOOTER_TEXT, OFFLINE_WORKS_NOTE, PRIVACY_POLICY_TITLE, SUPPORT_TITLE } from '../content/claims';

export interface AppFooterProps {
  onDelete: () => void;
  /** Append-only consent choices, shown in a small list. */
  consentHistory?: readonly ConsentHistoryRecord[];
}

/** Shown on every page. Links are in-page hash views; nothing is fetched. Deleting needs a second, explicit step. */
export function AppFooter({ onDelete, consentHistory }: AppFooterProps) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const restore = useRef(false);

  // Focus goes to the safe choice when the question opens, and back to the trigger if the person backs out.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (restore.current) {
      restore.current = false;
      trigger.current?.focus();
    }
  }, [confirming]);

  const back = () => {
    restore.current = true;
    setConfirming(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') back();
  };

  return (
    <footer className="app-footer no-print">
      <div className="container">
        <p>{FOOTER_TEXT}</p>
        {consentHistory && <ConsentHistory history={consentHistory} />}
        <p className="card-state">{OFFLINE_WORKS_NOTE}</p>
        <nav aria-label="More information" className="footer-links">
          <a href="#/sources">{FOOTER_SOURCES}</a>
          <a href="#/model-card">{FOOTER_MODEL_CARD}</a>
          <a href="privacy.html">{PRIVACY_POLICY_TITLE}</a>
          <a href="support.html">{SUPPORT_TITLE}</a>
          <button
            ref={trigger}
            type="button"
            className="btn btn-secondary btn-danger-quiet"
            aria-expanded={confirming}
            aria-controls="confirm-delete"
            onClick={() => setConfirming(true)}
          >
            {DELETE_DATA_LABEL}
          </button>
        </nav>
        {confirming && (
          <div id="confirm-delete" className="confirm-delete" role="alertdialog" aria-labelledby="confirm-delete-t" aria-describedby="confirm-delete-d" onKeyDown={onKeyDown}>
            <p id="confirm-delete-t" className="confirm-title">Delete everything you entered?</p>
            <p id="confirm-delete-d">This clears your answers, any wearable readings, any recording results, your summary and your consent history from this browser tab. It cannot be undone.</p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                Yes, delete my data
              </button>
              <button ref={cancel} type="button" className="btn btn-secondary" onClick={back}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
