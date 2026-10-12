import { useId } from 'react';
import type { QuietGap, WindowObs } from '../types/audio';

export interface LoudnessChartProps {
  /** RMS dB per second. */
  loudness: number[];
  quietGaps: QuietGap[];
  /** Optional: only windows with snoreLike are drawn. Scores are never shown. */
  windows?: WindowObs[];
}

const W = 600;
const H = 150;
const PAD = { l: 4, r: 4, t: 6, b: 6 };

/** Axis text lives in HTML, not in the SVG, so it keeps a readable size when the chart scales down on phones. */
const timeText = (sec: number) => (sec >= 120 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`);

export function LoudnessChart({ loudness, quietGaps, windows }: LoudnessChartProps) {
  const sid = useId();
  const n = loudness.length;
  if (n === 0) return <p>No loudness data to show.</p>;
  const snore = (windows ?? []).filter((w) => w.snoreLike);
  const min = Math.min(...loudness);
  const max = Math.max(...loudness);
  const span = max - min || 1;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const total = Math.max(n - 1, 1);
  const x = (t: number) => PAD.l + (Math.min(Math.max(t, 0), total) / total) * plotW;
  const y = (db: number) => PAD.t + (1 - (db - min) / span) * plotH;
  const path = loudness.map((db, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(db).toFixed(1)}`).join(' ');
  const gapSec = quietGaps.reduce((s, g) => s + g.durSec, 0);
  const summary =
    `Loudness over ${n} seconds, from ${min.toFixed(0)} to ${max.toFixed(0)} dB. ` +
    `${quietGaps.length} quiet ${quietGaps.length === 1 ? 'period' : 'periods'} found` +
    (quietGaps.length ? ` (${Math.round(gapSec)} seconds in total). ` : '. ') +
    ((windows ?? []).length > 0
      ? `${snore.length} ${snore.length === 1 ? 'window' : 'windows'} marked as a snore-like pattern. `
      : 'Snore-like patterns were not assessed. ') +
    'Quiet periods are only moments of low sound. They do not show breathing and do not rule sleep apnea in or out.';
  const hatch = `hatch-${sid.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="chart-plot">
        <div className="chart-yaxis" aria-hidden="true">
          <span>{max.toFixed(0)} dB</span>
          <span>{min.toFixed(0)} dB</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Loudness timeline" aria-describedby={sid}>
          <defs>
            <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--chart-gap)" opacity="0.14" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--chart-gap)" strokeWidth="2" />
            </pattern>
          </defs>
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--border-strong)" />
          <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--border-strong)" />
          {quietGaps.map((g) => (
            <rect key={`g${g.t0}`} x={x(g.t0)} y={PAD.t} width={Math.max(x(g.t1) - x(g.t0), 2)} height={plotH} fill={`url(#${hatch})`} stroke="var(--chart-gap)" strokeDasharray="4 2" />
          ))}
          {snore.map((w) => (
            <rect key={`s${w.t0}`} x={x(w.t0)} y={H - PAD.b - 8} width={Math.max(x(w.t1) - x(w.t0), 2)} height={8} fill="var(--chart-snore)" />
          ))}
          <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth="2" />
        </svg>
        <div className="chart-xaxis" aria-hidden="true">
          <span>0 s</span>
          <span>Time</span>
          <span>{timeText(total)}</span>
        </div>
      </div>
      <ul className="chart-legend" aria-label="Chart key">
        <li><span className="swatch swatch-line" aria-hidden="true" />Line: loudness (higher means louder)</li>
        <li><span className="swatch swatch-gap" aria-hidden="true" />Hatched band: quiet period</li>
        {snore.length > 0 && <li><span className="swatch swatch-snore" aria-hidden="true" />Solid bar along the bottom: snore-like pattern observed</li>}
      </ul>
      <figcaption id={sid} className="chart-summary">{summary}</figcaption>
    </figure>
  );
}
