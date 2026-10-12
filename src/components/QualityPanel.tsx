import type { QualityReport } from '../types/audio';
import { Icon, type IconName } from './Icon';

const VERDICT: Record<QualityReport['verdict'], { icon: IconName; text: string }> = {
  usable: { icon: 'info', text: 'Usable for simple measures' },
  marginal: { icon: 'caution', text: 'Marginal quality' },
  unusable: { icon: 'ban', text: 'Not usable' },
};

export interface QualityPanelProps {
  quality: QualityReport;
}

export function QualityPanel({ quality }: QualityPanelProps) {
  const v = VERDICT[quality.verdict];
  const mins = Math.floor(quality.durationSec / 60);
  const secs = Math.round(quality.durationSec % 60);
  return (
    <section className="quality" aria-label="Recording quality">
      <h3>Recording quality</h3>
      <p>
        <span className={`verdict verdict-${quality.verdict}`}>
          <Icon name={v.icon} /> {v.text}
        </span>
      </p>
      <dl>
        <dt>Length</dt>
        <dd>{mins} min {secs} s</dd>
        <dt>Clipped samples</dt>
        <dd>{quality.clippingPct.toFixed(1)}%</dd>
        <dt>Background noise level</dt>
        <dd>{quality.noiseFloorDb.toFixed(0)} dB</dd>
        <dt>Mostly silent portion</dt>
        <dd>{(quality.silenceRatio * 100).toFixed(0)}%</dd>
      </dl>
      {quality.reasons.length > 0 && (
        <ul aria-label="Quality notes">
          {quality.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p>A recording that looks fine here still cannot rule out sleep apnea.</p>
    </section>
  );
}
