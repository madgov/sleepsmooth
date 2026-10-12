import { describe, expect, it } from 'vitest';
import { CLAIMS_VERIFIED, type ClaimsVerified } from '../../mobile/src/content/flags';
import { bystanderNotice, clipBackupNote, idleSubcopy, lockNote, privacyRows, privacyTitle } from '../../mobile/src/content/copy';

describe('gated claims', () => {
  it('ships with every flag false', () => {
    expect(Object.values(CLAIMS_VERIFIED).every((v) => v === false)).toBe(true);
  });
  it('renders fallbacks (no unverified sentence) by default', () => {
    expect(privacyTitle()).toBe('About your privacy');
    expect(privacyRows().map((r) => r.id)).toEqual(['N04', 'N06', 'N07']);
    expect(privacyRows().map((r) => r.text).join(' ')).not.toMatch(/uploaded|discarded|not saved|not keep/i);
    expect(bystanderNotice()).not.toMatch(/does not keep audio/);
    expect(idleSubcopy()).not.toMatch(/locked/);
    expect(lockNote()).toBeNull();
  });
  it('renders the gated sentences only when the matching flag is true', () => {
    const f: ClaimsVerified = { noNetworkVerified: true, audioNotWrittenVerified: true, noUploadNoTrackingVerified: true, lockedScreenVerified: true, clipsLocalOnlyVerified: true };
    expect(privacyTitle(f)).toBe('Your night stays on your phone');
    expect(privacyRows(f).map((r) => r.id)).toEqual(['N04', 'N05', 'N06', 'N07']);
    expect(bystanderNotice(f)).toMatch(/does not keep audio/);
    expect(idleSubcopy(f)).toMatch(/locked/);
    expect(lockNote(f)).toMatch(/lock your phone/);
  });
  it('never says audio is not saved when clip saving is on, even with every flag true', () => {
    const f: ClaimsVerified = { noNetworkVerified: true, audioNotWrittenVerified: true, noUploadNoTrackingVerified: true, lockedScreenVerified: true, clipsLocalOnlyVerified: true };
    for (const flags of [CLAIMS_VERIFIED, f]) {
      const text = [bystanderNotice(flags, true), ...privacyRows(flags, true).map((r) => r.text)].join(' ');
      expect(text).not.toMatch(/not saved|does not keep audio|discarded/i);
      expect(text).toMatch(/clips/i);
    }
  });
  it('gates the backup note', () => {
    expect(clipBackupNote()).toBeNull();
    expect(clipBackupNote({ ...CLAIMS_VERIFIED, clipsLocalOnlyVerified: true })).toMatch(/backups/);
  });
});
