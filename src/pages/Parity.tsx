// Hidden parity page: recomputes golden cases in this browser and compares with the Node JSON,
// then decodes the mp3/m4a fixtures with the browser decoder, aligns for decoder delay by
// cross-correlation, and compares features with the documented codec tolerance.
import { useEffect, useState } from 'react';
import { GOLDEN_CASES, GOLDEN_TOLERANCE, maxAbsDiff, type GoldenFile } from '../audio/features/golden/goldenCases';
import { CODEC_TOLERANCE, codecFeatures, meanAbsDiff, type CodecExpected } from '../audio/features/golden/codecParity';
import mp3Url from '../audio/features/golden/fixtures/parity.mp3?url';
import m4aUrl from '../audio/features/golden/fixtures/parity.m4a?url';
import expectedJson from '../audio/features/golden/fixtures/expected.json';

const files = import.meta.glob('../audio/features/golden/golden/*.json', { eager: true, import: 'default' }) as Record<string, GoldenFile>;

export interface ParityRow {
  name: string;
  diff: number;
  pass: boolean;
  note?: string;
}

export function ParityView({ rows, codecRows, codecStatus }: { rows: ParityRow[]; codecRows: ParityRow[]; codecStatus?: string }) {
  const all = [...rows, ...codecRows].every((r) => r.pass);
  const table = (title: string, rs: ParityRow[], metric: string) => (
    <>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>{metric}</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rs.map((r) => (
            <tr key={r.name}>
              <td>
                {r.name}
                {r.note ? ` (${r.note})` : ''}
              </td>
              <td>{r.diff.toExponential(2)}</td>
              <td>{r.pass ? 'pass' : 'fail'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
  return (
    <section aria-labelledby="parity-h">
      <h2 id="parity-h">Feature parity check</h2>
      <p role="status" data-testid="parity-summary">
        {all ? 'PASS: all cases match' : 'FAIL: some cases differ'}
      </p>
      {table(`Golden vectors (max abs difference, tolerance ${GOLDEN_TOLERANCE})`, rows, 'Max abs difference')}
      {table(`Compressed formats (mean abs log-mel difference, codec tolerance ${CODEC_TOLERANCE})`, codecRows, 'Mean abs difference')}
      {codecStatus && <p>{codecStatus}</p>}
    </section>
  );
}

async function decodeFixture(url: string): Promise<AudioBuffer> {
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(data);
  } finally {
    void ctx.close();
  }
}

export function Parity() {
  const byName = new Map(Object.values(files).map((f) => [f.name, f]));
  const rows = GOLDEN_CASES.map((c) => {
    const g = byName.get(c.name);
    const diff = g ? maxAbsDiff(c.compute(), g.values) : Infinity;
    return { name: c.name, diff, pass: diff < GOLDEN_TOLERANCE };
  });
  const [codecRows, setCodecRows] = useState<ParityRow[]>([]);
  const [status, setStatus] = useState('Decoding compressed fixtures...');
  useEffect(() => {
    let live = true;
    (async () => {
      const out: ParityRow[] = [];
      const expected = (expectedJson as { expected: CodecExpected[] }).expected;
      for (const [format, url] of [['mp3', mp3Url], ['m4a', m4aUrl]] as const) {
        try {
          const buf = await decodeFixture(url);
          const { lag, values } = codecFeatures(buf.getChannelData(0), buf.sampleRate);
          const exp = expected.find((e) => e.format === format);
          const diff = exp ? meanAbsDiff(values, exp.values) : Infinity;
          out.push({ name: format, diff, pass: diff < CODEC_TOLERANCE, note: `aligned offset ${lag} samples at 16 kHz` });
        } catch {
          out.push({ name: format, diff: Infinity, pass: false, note: 'decode failed in this browser' });
        }
      }
      if (live) {
        setCodecRows(out);
        setStatus('');
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return <ParityView rows={rows} codecRows={codecRows} codecStatus={status} />;
}
