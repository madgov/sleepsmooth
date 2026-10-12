import { useRef, useState, type ReactNode } from 'react';
import {
  FIELD_ERROR_POSITIVE,
  FORM_ERROR_SUMMARY,
  NOSAS_CITATION,
  NOSAS_CUTOFF_TEXT,
  NOSAS_ITEM_SKIPPED_NOTE,
  NOSAS_POINTS_TABLE,
  NOSAS_QUESTIONS,
  NOSAS_URLS,
  RED_FLAG_NOTE,
  RED_FLAG_QUESTION,
  SYMPTOM_CHECKLIST_NOTE,
  SYMPTOM_NOT_VALIDATED,
} from '../content/claims';
import { activeInstrument } from '../questionnaire/registry';
import { unitSystem } from '../questionnaire/instruments/noSas';
import { FREQUENCIES, FREQUENCY_LABELS, SYMPTOM_ITEMS, type SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { AnswerValue } from '../types/questionnaire';
import type { SymptomFrequency } from '../types/questionnaire';
import { useSession } from '../state/session';
import { DemoBanner, Icon, useFocusHeading } from '../components';

type Stage = 'nosas' | 'symptoms' | 'review';

function isBad(value: AnswerValue | undefined): boolean {
  return typeof value === 'number' && !(value > 0);
}

function NumberField({ id, label, value, onChange, unit, submitted }: { id: string; label: string; value: AnswerValue | undefined; onChange: (v: number | null) => void; unit?: string; submitted?: boolean }) {
  const n = typeof value === 'number' ? value : '';
  // Check when the person leaves the field (or tries to continue), not on every keystroke.
  const [touched, setTouched] = useState(false);
  const invalid = isBad(value) && (touched || Boolean(submitted));
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit ? ` (${unit})` : ''}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={n}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        onBlur={() => setTouched(true)}
      />
      {invalid && (
        <span id={`${id}-err`} role="alert" className="field-error">
          <Icon name="alert" />
          {FIELD_ERROR_POSITIVE}
        </span>
      )}
    </div>
  );
}

export function Questionnaire({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const s = useSession();
  const [stage, setStage] = useState<Stage>('nosas');
  const [showErrors, setShowErrors] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useFocusHeading(root, stage);
  const a = s.answers;
  const imperial = unitSystem(a) === 'imperial';

  const setA = (k: string, v: AnswerValue | undefined) => {
    const next = { ...a };
    if (v === undefined || v === null) delete next[k];
    else next[k] = v;
    s.setAnswers(next);
  };
  const setSym = (key: string, f: SymptomFrequency) => s.setSymptoms({ ...s.symptoms, [key]: f } as SymptomAnswers);

  const score = activeInstrument.score(a);
  const hasBad = ['height', 'weight', 'neck', 'age'].some((k) => isBad(a[k]));
  const nextFromNosas = () => {
    if (hasBad) {
      setShowErrors(true);
      // Move focus to the first field that needs fixing.
      const firstBad = (['height', 'weight', 'neck', 'age'] as const).find((k) => isBad(a[k]));
      if (firstBad) document.getElementById(`q-${firstBad}`)?.focus();
      return;
    }
    setShowErrors(false);
    setStage('symptoms');
  };
  const wrap = (children: ReactNode) => (
    <div ref={root}>
      <DemoBanner isSynthetic={s.isSynthetic} />
      {children}
    </div>
  );

  if (stage === 'nosas') {
    return wrap(
      <section aria-labelledby="q-h">
        <h2 id="q-h">Your screening questions</h2>
        <p>Step 1 of 3: {activeInstrument.title}, a published screening score. Skip anything you do not know; skipped items are listed as missing.</p>
        <details open>
          <summary>How this score works</summary>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {NOSAS_POINTS_TABLE.map((r) => (
                <tr key={r.item}>
                  <td>{r.item}</td>
                  <td>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p>{NOSAS_CUTOFF_TEXT}</p>
          <p>
            Source: {NOSAS_CITATION} <a href={NOSAS_URLS[0]}>View the source</a>
          </p>
        </details>
        <fieldset>
          <legend>{NOSAS_QUESTIONS.units}</legend>
          {(['metric', 'imperial'] as const).map((u) => (
            <label key={u} className="choice">
              <input type="radio" name="units" checked={unitSystem(a) === u} onChange={() => setA('units', u)} /> {u === 'metric' ? 'Metric (cm, kg)' : 'Imperial (in, lb)'}{' '}
            </label>
          ))}
        </fieldset>
        <NumberField id="q-height" submitted={showErrors} label={NOSAS_QUESTIONS.height} unit={imperial ? 'inches' : 'cm'} value={a.height} onChange={(v) => setA('height', v)} />
        <NumberField id="q-weight" submitted={showErrors} label={NOSAS_QUESTIONS.weight} unit={imperial ? 'lb' : 'kg'} value={a.weight} onChange={(v) => setA('weight', v)} />
        <NumberField id="q-neck" submitted={showErrors} label={NOSAS_QUESTIONS.neck} unit={imperial ? 'inches' : 'cm'} value={a.neckUnknown === true ? undefined : a.neck} onChange={(v) => setA('neck', v)} />
        <p>
          <label className="choice">
            <input type="checkbox" checked={a.neckUnknown === true} onChange={(e) => setA('neckUnknown', e.target.checked ? true : undefined)} /> {NOSAS_QUESTIONS.neckUnknown}
          </label>
        </p>
        <fieldset>
          <legend>{NOSAS_QUESTIONS.snoring}</legend>
          {[true, false].map((v) => (
            <label key={String(v)} className="choice">
              <input type="radio" name="snoring" checked={a.snoring === v} onChange={() => setA('snoring', v)} /> {v ? 'Yes' : 'No'}{' '}
            </label>
          ))}
        </fieldset>
        <NumberField id="q-age" submitted={showErrors} label={NOSAS_QUESTIONS.age} value={a.age} onChange={(v) => setA('age', v)} />
        <fieldset>
          <legend>{NOSAS_QUESTIONS.sex}</legend>
          {(['male', 'female'] as const).map((v) => (
            <label key={v} className="choice">
              <input type="radio" name="sex" checked={a.sex === v} onChange={() => setA('sex', v)} /> {v === 'male' ? 'Male' : 'Female'}{' '}
            </label>
          ))}
          <p>{NOSAS_QUESTIONS.sexNote}</p>
        </fieldset>
        <p>{NOSAS_ITEM_SKIPPED_NOTE}</p>
        {showErrors && hasBad && (
          <p role="alert" className="field-error">
            <Icon name="alert" />
            {FORM_ERROR_SUMMARY}
          </p>
        )}
        <div className="actions nav-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" className="btn" onClick={nextFromNosas}>
            Next: symptoms
          </button>
        </div>
      </section>,
    );
  }

  if (stage === 'symptoms') {
    return wrap(
      <section aria-labelledby="sym-h">
        <h2 id="sym-h">Your symptoms</h2>
        <p>Step 2 of 3. Rate how often each of these happens.</p>
        <p>
          <strong>{SYMPTOM_NOT_VALIDATED}.</strong> {SYMPTOM_CHECKLIST_NOTE}
        </p>
        {SYMPTOM_ITEMS.map((i) => (
          <fieldset key={i.key}>
            <legend>{i.text}</legend>
            {FREQUENCIES.map((f) => (
              <label key={f} className="choice">
                <input type="radio" name={i.key} checked={s.symptoms[i.key] === f} onChange={() => setSym(i.key, f)} /> {FREQUENCY_LABELS[f]}{' '}
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset>
          <legend>{RED_FLAG_QUESTION}</legend>
          {[true, false].map((v) => (
            <label key={String(v)} className="choice">
              <input type="radio" name="redFlag" checked={s.redFlag === v} onChange={() => s.setRedFlag(v)} /> {v ? 'Yes' : 'No'}{' '}
            </label>
          ))}
          <p>{RED_FLAG_NOTE}</p>
        </fieldset>
        <div className="actions nav-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setStage('nosas')}>
            Back
          </button>
          <button type="button" className="btn" onClick={() => setStage('review')}>
            Review my answers
          </button>
        </div>
      </section>,
    );
  }

  return wrap(
    <section aria-labelledby="rev-h">
      <h2 id="rev-h">Review your answers</h2>
      <p>Step 3 of 3. You can change any answer before continuing.</p>
      <h3>{activeInstrument.title}</h3>
      <dl>
        {[
          ['Height', a.height === undefined || a.height === null ? a.height : `${a.height} ${imperial ? 'inches' : 'cm'}`],
          ['Weight', a.weight === undefined || a.weight === null ? a.weight : `${a.weight} ${imperial ? 'lb' : 'kg'}`],
          ['Neck circumference', a.neckUnknown === true ? "I don't know" : a.neck === undefined || a.neck === null ? a.neck : `${a.neck} ${imperial ? 'inches' : 'cm'}`],
          ['Snoring', a.snoring === undefined ? undefined : a.snoring ? 'Yes' : 'No'],
          ['Age', a.age],
          ['Sex assigned at birth', a.sex === 'male' ? 'Male' : a.sex === 'female' ? 'Female' : a.sex],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt>{k}</dt>
            <dd>{v === undefined || v === null ? 'Not answered' : String(v)}</dd>
          </div>
        ))}
      </dl>
      <p>
        {score.total === null ? `Score: ${score.band}.` : `Score: ${score.total} of 17.`} {score.explanation}
      </p>
      <p>
        <button type="button" className="btn btn-secondary" onClick={() => setStage('nosas')}>
          Edit screening answers
        </button>
      </p>
      <h3>Symptom checklist ({SYMPTOM_NOT_VALIDATED})</h3>
      <dl>
        {SYMPTOM_ITEMS.map((i) => (
          <div key={i.key}>
            <dt>{i.text}</dt>
            <dd>{s.symptoms[i.key] ? FREQUENCY_LABELS[s.symptoms[i.key] as SymptomFrequency] : 'Not answered'}</dd>
          </div>
        ))}
        <div>
          <dt>{RED_FLAG_QUESTION}</dt>
          <dd>{s.redFlag === null ? 'Not answered' : s.redFlag ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
      <p>
        <button type="button" className="btn btn-secondary" onClick={() => setStage('symptoms')}>
          Edit symptoms
        </button>
      </p>
      <div className="actions nav-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setStage('symptoms')}>
          Back
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Continue to the recording step
        </button>
      </div>
    </section>,
  );
}
