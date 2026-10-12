import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DELETE_DATA_LABEL, FOOTER_MODEL_CARD, FOOTER_SOURCES, FOOTER_TEXT } from '../content/claims';

export interface AppFooterProps {
  onDelete: () => void;
}

/** Shown on every page. Links are in-page hash views; nothing is fetched. Deleting needs a second, explicit step. */
export function AppFooter({ onDelete }: AppFooterProps) {
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
        <nav aria-label="More information" className="footer-links">
          <a href="#/sources">{FOOTER_SOURCES}</a>
          <a href="#/model-card">{FOOTER_MODEL_CARD}</a>
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
            <p id="confirm-delete-d">This clears your answers, any recording results and your summary from this browser tab. It cannot be undone.</p>
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
