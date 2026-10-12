import {
  CONSENT_DETAIL,
  CONSENT_LABEL,
  DISCLAIMER_AUDIO,
  DISCLAIMER_CANNOT_RULE_OUT,
  DISCLAIMER_NOT_DIAGNOSIS,
  DISCLAIMER_SEEK_CARE,
  WELCOME_CAN,
  WELCOME_CANNOT,
  WELCOME_LIMITS_HEADING,
  WELCOME_NEEDS_CONSENT,
  WELCOME_PURPOSE,
  WELCOME_START_OWN,
  WELCOME_START_OWN_NOTE,
  WELCOME_TITLE,
  WELCOME_TRY_EXAMPLE,
  WELCOME_TRY_EXAMPLE_NOTE,
  WELCOME_VALUE_PROP,
} from '../content/claims';
import { ConsentGate } from '../components';
import { demoCase } from '../demo';
import type { SymptomAnswers } from '../questionnaire/symptomChecklist';
import { useSession } from '../state/session';

/** Loads the synthetic Dana case into the session. Shared by Welcome and the audio step. */
export function useLoadDemoCase() {
  const s = useSession();
  return () => {
    const symptoms: SymptomAnswers = {};
    for (const e of demoCase.symptoms) symptoms[e.key] = e.frequency;
    s.loadCase({ answers: demoCase.screening.answers, symptoms, redFlag: false, audio: demoCase.audio });
  };
}

export function Welcome({ onStart, onExample }: { onStart: () => void; onExample?: () => void }) {
  const s = useSession();
  const granted = s.consent?.granted === true;
  const loadDemo = useLoadDemoCase();

  const tryExample = () => {
    loadDemo();
    (onExample ?? onStart)();
  };
  const startOwn = () => {
    // Never mix a previous synthetic case into a real check.
    if (s.isSynthetic) {
      s.deleteMyData();
      s.setConsent(true); // the box was already ticked: the button is disabled otherwise
    }
    onStart();
  };

  return (
    <section aria-labelledby="welcome-h">
      <h2 id="welcome-h">{WELCOME_TITLE}</h2>
      <p className="lead">{WELCOME_VALUE_PROP}</p>
      <div className="card limits" role="group" aria-labelledby="limits-h">
        <h3 id="limits-h">{WELCOME_LIMITS_HEADING}</h3>
        <p>{DISCLAIMER_NOT_DIAGNOSIS}</p>
        <details className="read-more">
          <summary>Read more about what it can and cannot do</summary>
          <p>{WELCOME_PURPOSE}</p>
          <ul>
            {WELCOME_CANNOT.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>
            {DISCLAIMER_AUDIO} {DISCLAIMER_CANNOT_RULE_OUT}
          </p>
          <p>{DISCLAIMER_SEEK_CARE}</p>
          <h4>What it can do</h4>
          <ul>
            {WELCOME_CAN.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="path-grid">
        <div className="card path path-primary">
          <h3>{WELCOME_TRY_EXAMPLE}</h3>
          <p>{WELCOME_TRY_EXAMPLE_NOTE}</p>
          <button type="button" className="btn" onClick={tryExample}>
            {WELCOME_TRY_EXAMPLE}
          </button>
        </div>
        <div className="card path">
          <h3>{WELCOME_START_OWN}</h3>
          <p>{WELCOME_START_OWN_NOTE}</p>
          <ConsentGate title="Before you start" description={CONSENT_DETAIL} checkboxLabel={CONSENT_LABEL} granted={granted} onChange={s.setConsent} />
          <p className="actions">
            <button type="button" className="btn btn-secondary" onClick={startOwn} disabled={!granted} aria-describedby="own-hint">
              {WELCOME_START_OWN}
            </button>
          </p>
          <p id="own-hint" className="hint">
            {granted ? '' : WELCOME_NEEDS_CONSENT}
          </p>
        </div>
      </div>
    </section>
  );
}
