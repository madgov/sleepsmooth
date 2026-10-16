import {
  BACK_TO_CHECK,
  DISCLAIMER_NOT_DIAGNOSIS,
  MODEL_CARD_HEADING,
  MODEL_CARD_INTENDED,
  MODEL_CARD_LICENSE,
  MODEL_CARD_NOT_FOR,
  MODEL_CARD_OTHER_LIMITS,
  MODEL_CARD_PHONE_WEAKNESS,
  MODEL_CARD_TITLE,
  NOSAS_ACCURACY_CAVEAT,
  NOSAS_ACCURACY_RANGES,
  NOSAS_CITATION,
  NOSAS_SCREENING_NOT_DIAGNOSIS,
  NOSAS_URLS,
  NO_MODEL_LINE,
  RED_FLAG_NOTE,
  SAMPLE_AUDIO_ATTRIBUTION,
  SAMPLE_AUDIO_LABEL,
  SOURCES_INTRO,
  SOURCES_TITLE,
  SYMPTOM_CHECKLIST_NOTE,
} from '../content/claims';
import { ModelCardNumbers } from '../components';
import { loadShippedModel } from '../audio/model/infer';

function Back() {
  return (
    <p className="actions no-print">
      <a className="btn btn-secondary" href="#/">
        {BACK_TO_CHECK}
      </a>
    </p>
  );
}

export function SourcesView() {
  const a = NOSAS_ACCURACY_RANGES;
  return (
    <section aria-labelledby="src-h">
      <h2 id="src-h" tabIndex={-1}>
        {SOURCES_TITLE}
      </h2>
      <p>{SOURCES_INTRO}</p>
      <h3>Screening score (NoSAS)</h3>
      <p>{NOSAS_CITATION}</p>
      <ul>
        {NOSAS_URLS.map((u) => (
          <li key={u}>
            <a href={u}>{u}</a>
          </li>
        ))}
      </ul>
      <p>{NOSAS_SCREENING_NOT_DIAGNOSIS}</p>
      <p>
        In a sleep-clinic study ({a.source}), at a score of 8 or more, sensitivity ranged from {a.sensitivityPct.ahi5}% to {a.sensitivityPct.ahi30}% and specificity from {a.specificityPct.ahi30}% to{' '}
        {a.specificityPct.ahi5}%, depending on how sleep apnea was defined. These {NOSAS_ACCURACY_CAVEAT}
      </p>
      <h3>Symptom checklist</h3>
      <p>{SYMPTOM_CHECKLIST_NOTE}</p>
      <h3>Drowsy driving</h3>
      <p>{RED_FLAG_NOTE}</p>
      <h3>Sample recording</h3>
      <p>
        {SAMPLE_AUDIO_LABEL}. {SAMPLE_AUDIO_ATTRIBUTION}
      </p>
      <p>{DISCLAIMER_NOT_DIAGNOSIS}</p>
      <Back />
    </section>
  );
}

export function ModelCardView() {
  const model = loadShippedModel();
  return (
    <section aria-labelledby="mc-h">
      <h2 id="mc-h" tabIndex={-1}>
        {MODEL_CARD_TITLE}
      </h2>
      <h3>{MODEL_CARD_HEADING}</h3>
      {model ? <p>Snore model version: {model.version}</p> : <p>{NO_MODEL_LINE}</p>}
      <ul>
        <li>{MODEL_CARD_INTENDED}</li>
        <li>{MODEL_CARD_NOT_FOR}</li>
        <li>{MODEL_CARD_PHONE_WEAKNESS}</li>
        <li>{MODEL_CARD_OTHER_LIMITS}</li>
      </ul>
      <h3>Test results</h3>
      <ModelCardNumbers />
      <p>{MODEL_CARD_LICENSE}</p>
      {import.meta.env.DEV && (
        <p>
          <a href="?parity">Technical verification (development builds only)</a>: checks in your browser that the audio processing code gives the same numbers as the training code.
        </p>
      )}
      <p>{DISCLAIMER_NOT_DIAGNOSIS}</p>
      <Back />
    </section>
  );
}
