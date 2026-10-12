import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RED_FLAG_NOTE, RED_FLAG_WORDING } from '../content/claims';
import { redFlagsFor } from './redFlags';

const md = readFileSync('docs/SOURCES.md', 'utf8');
const rows = md
  .slice(md.indexOf('## 4. Red-flag wording'))
  .split('\n')
  .filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Flag'))
  .map((l) => l.split('|').map((c) => c.trim()));

describe('red-flag wording matches SOURCES.md', () => {
  it('has the three candidate rows', () => expect(rows).toHaveLength(3));
  it('drowsy-driving row is verified, with a URL and the in-app wording', () => {
    const r = rows.find((c) => /driving/i.test(c[1] ?? ''))!;
    expect(r[5]).toMatch(/^true/);
    expect(r[4]).toMatch(/^https:\/\//);
    expect(r[2]).toContain(RED_FLAG_WORDING);
    expect(r[2]).toContain(RED_FLAG_NOTE.split('. ')[0]!.replace(/\.$/, ''));
  });
  it('unverified rows are not wired in as red flags', () => {
    for (const r of rows.filter((c) => !/^true/.test(c[5] ?? ''))) expect(r[6]).toBe('no');
  });
  it('wording is prompt-talk-to-clinician, not triage', () => {
    expect(RED_FLAG_WORDING).toMatch(/talk to a clinician promptly/);
    expect(RED_FLAG_WORDING + RED_FLAG_NOTE).not.toMatch(/emergency|911|call an ambulance/i);
  });
  it('only the drowsy-driving flag is emitted', () => {
    const base = { noSas: 'below', symptoms: 'none', audio: 'notProvided', isSynthetic: false } as const;
    expect(redFlagsFor({ ...base, redFlagPresent: true })).toEqual([RED_FLAG_WORDING, RED_FLAG_NOTE]);
    expect(redFlagsFor({ ...base, redFlagPresent: false })).toEqual([]);
  });
});
