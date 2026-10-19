import {
  MODEL_CARD_AUC_PLAIN,
  MODEL_CARD_NO_REAL_PHONE,
  MODEL_CARD_PHONE_QUALITY,
  MODEL_CARD_PRECISION_PLAIN,
  MODEL_CARD_RUNNING_LINE,
  MODEL_CARD_SMALL_TEST,
  MODEL_CARD_SOURCE_LINE,
  MODEL_CARD_V3_WEB_HEADING,
  MODEL_CARD_V3_SMALL,
  MODEL_CARD_V3_WEB_STATUS,
} from '../content/claims';
import { V1_EVALUATION, V3_EVALUATION, formatRange, formatValue, type ModelCardEvaluation } from '../audio/modelCardInfo';

function Metrics({ ev }: { ev: ModelCardEvaluation }) {
  return (
    <ul>
      {ev.metrics.map((m) => (
        <li key={m.label}>
          {m.label}: {formatValue(m)}
          {formatRange(m) ? ` (95% range ${formatRange(m)})` : ''}
        </li>
      ))}
    </ul>
  );
}

/** Web app: the evaluated numbers for the model this website runs (v1), the plain caveats, and a note on v3 (iPhone app only). */
export function ModelCardNumbers() {
  return (
    <div data-testid="model-card-numbers">
      <p>{MODEL_CARD_RUNNING_LINE}</p>
      <p>
        <strong>{V1_EVALUATION.heading}</strong>, tested on {V1_EVALUATION.testSet}:
      </p>
      <Metrics ev={V1_EVALUATION} />
      <ul>
        <li>{MODEL_CARD_AUC_PLAIN}</li>
        <li>{MODEL_CARD_PRECISION_PLAIN}</li>
        <li>{MODEL_CARD_SMALL_TEST}</li>
        <li>{MODEL_CARD_NO_REAL_PHONE}</li>
        <li>{MODEL_CARD_PHONE_QUALITY}</li>
      </ul>
      <p className="card-citation">{MODEL_CARD_SOURCE_LINE}</p>
      <h4>{MODEL_CARD_V3_WEB_HEADING}</h4>
      <p>{MODEL_CARD_V3_WEB_STATUS}</p>
      <Metrics ev={V3_EVALUATION} />
      <p>{MODEL_CARD_V3_SMALL}</p>
    </div>
  );
}
