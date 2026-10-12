// Claims that are only true after a device test passes (IOS_DESIGN section 8 "GATED"; DEVICE_TEST.md).
// Every flag is false by default so the gated sentence does not render. Flip a flag only when the named test has passed
// on a real device AND the orchestrator has approved it. Do not read these from a server or from user input.
export interface ClaimsVerified {
  noNetworkVerified: boolean;
  audioNotWrittenVerified: boolean;
  noUploadNoTrackingVerified: boolean;
  lockedScreenVerified: boolean;
  /** Clips are excluded from device backups. Needs a device check of the clips folder's backup flag. */
  clipsLocalOnlyVerified: boolean;
}

export const CLAIMS_VERIFIED: ClaimsVerified = {
  /** N-03: needs a "no network symbols in mobile/src" check to pass. */
  noNetworkVerified: false,
  /** N-04, N-06 and the last sentence of N-21: needs the M2 file-system diff test (audio never written). */
  audioNotWrittenVerified: false,
  /** N-05: needs the no-network and no-analytics checks. */
  noUploadNoTrackingVerified: false,
  /** N-25, N-31: needs the M1 30 minute locked-screen pass. */
  lockedScreenVerified: false,
  /** Gates "Clips are kept out of iPhone backups" (clipBackupNote). Needs the device check that NSURLIsExcludedFromBackupKey really was set on the clips folder. */
  clipsLocalOnlyVerified: false,
};

