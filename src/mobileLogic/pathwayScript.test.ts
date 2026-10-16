import { describe, expect, it } from 'vitest';
import { buildClinicianScript, reportedSymptoms, scriptToText } from './pathwayScript';
import { REMINDER_CHOICES, activeReminder, reminderDate, sanitizeTrackerTicks, toggleTick } from './followThrough';

const empty = { symptoms: {}, redFlag: null, questionnaireAnswered: false, recordedNights: 0, snoreLikeNights: 0 };

describe('buildClinicianScript', () => {
  it('works with no data: opener, placeholder, question, zero facts', () => {
    const b = buildClinicianScript(empty);
    expect(b.factCount).toBe(0);
    expect(b.lines[0]).toMatch(/talk about my sleep/);
    expect(b.lines.some((l) => l.includes('____'))).toBe(true);
    expect(b.lines.at(-1)).toMatch(/home sleep test/);
  });
  it('uses only non-"never" symptoms with frequency', () => {
    expect(reportedSymptoms({ 'loud-snoring': 'often', 'daytime-sleepiness': 'never', 'morning-headaches': 'sometimes' })).toEqual([
      'I snore loudly (often)',
      'I wake up with headaches (sometimes)',
    ]);
  });
  it('includes nights and snore-like count, and says it measures sound only', () => {
    const t = scriptToText(buildClinicianScript({ ...empty, recordedNights: 3, snoreLikeNights: 2 }));
    expect(t).toMatch(/record 3 nights/);
    expect(t).toMatch(/observed on 2 nights/);
    expect(t).toMatch(/does not measure breathing/);
  });
  it('a night without snore-like sound is not framed as reassurance', () => {
    const t = scriptToText(buildClinicianScript({ ...empty, recordedNights: 1, snoreLikeNights: 0 }));
    expect(t).toMatch(/record 1 night\./);
    expect(t).toMatch(/does not rule anything out/);
  });
  it('adds the driving line only when answered yes, and the sample label for sample data', () => {
    expect(scriptToText(buildClinicianScript({ ...empty, redFlag: false }))).not.toMatch(/driving/);
    const t = buildClinicianScript({ ...empty, redFlag: true, sample: true });
    expect(t.lines[0]).toMatch(/^Sample data/);
    expect(scriptToText(t)).toMatch(/while driving/);
  });
  it('never uses diagnosis or reassurance wording', () => {
    const full = scriptToText(buildClinicianScript({ symptoms: { 'loud-snoring': 'nightly' }, redFlag: true, questionnaireAnswered: true, recordedNights: 2, snoreLikeNights: 0 }));
    expect(full).not.toMatch(/diagnos|safe|low risk|probabilit|you have sleep apnea/i);
  });
});

describe('follow-through tracker', () => {
  it('toggles on and off, ignores unknown ids, and keeps other stored ids', () => {
    expect(toggleTick([], 'track-talked')).toEqual(['track-talked']);
    expect(toggleTick(['track-talked'], 'track-talked')).toEqual([]);
    expect(toggleTick(['x'], 'nope')).toEqual(['x']);
    expect(toggleTick(['x'], 'track-done')).toEqual(['x', 'track-done']);
  });
  it('sanitizes junk input', () => {
    expect(sanitizeTrackerTicks('bad')).toEqual([]);
    expect(sanitizeTrackerTicks(['track-done', 3, 'zzz', 'track-talked', 'track-done'])).toEqual(['track-talked', 'track-done']);
  });
  it('has no streak or count in the tracker model', () => {
    expect(Object.keys(REMINDER_CHOICES[0]!).sort()).toEqual(['days', 'id', 'label']);
  });
  it('computes a 09:00 reminder date and honours only future dates', () => {
    const now = new Date(2026, 9, 15, 20, 0, 0);
    const d = reminderDate(now, 7);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 22, 9, 0]);
    expect(activeReminder(d.toISOString(), now)?.getTime()).toBe(d.getTime());
    expect(activeReminder(new Date(2026, 9, 1).toISOString(), now)).toBeNull();
    expect(activeReminder('garbage', now)).toBeNull();
    expect(activeReminder(null, now)).toBeNull();
  });
});
