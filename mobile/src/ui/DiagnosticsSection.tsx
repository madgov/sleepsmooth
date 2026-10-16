import { useState } from 'react';
import { View } from 'react-native';
import { DIAG_DEV_PREVIEW, DIAG_EXPORT, DIAG_EXPORT_FAILED, DIAG_EXPORT_NOTE, DIAG_EXPORT_WEB, DIAG_HEADING, DIAG_INTRO, DIAG_NOT_VERIFIED, DIAG_NO_RECORD } from '@core/content/claims';
import { DEVICE_CRITERIA, diagnosticsNumbers, diagnosticsRows, evaluateCriteria, gapCauseLabel } from '@core/mobileLogic/diagnostics';
import type { NightListItem } from '../data/nightSource';
import { exportTestLog } from '../diagnostics/exportTestLog';
import { AppText } from './AppText';
import { clockFromMs } from './ClipPlayerRow';
import { Disclosure } from './Disclosure';
import { PrimaryButton } from './PrimaryButton';
import { Surface } from './Surface';

const RESULT_TEXT = { pass: 'Within target', fail: 'Outside target', 'not-evaluable': 'Not enough data' } as const;

/** Real nights only, collapsed by default. A technical record for testing; never part of the health summary. */
export function DiagnosticsSection({ night }: { night: NightListItem }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (night.isSample) return null;
  const d = night.diagnostics;
  const captured = night.view.epochs.reduce((a, e) => a + e.cap, 0);
  const nums = d ? diagnosticsNumbers(d, captured) : null;
  const crit = nums ? evaluateCriteria(nums) : null;
  const doExport = async () => {
    setBusy(true);
    setNote(null);
    const r = await exportTestLog(night);
    setBusy(false);
    setNote(r === 'web-unavailable' ? DIAG_EXPORT_WEB : r === 'failed' ? DIAG_EXPORT_FAILED : null);
  };
  return (
    <Surface padding={0} testID="diagnostics-section">
      <Disclosure title={DIAG_HEADING}>
        <AppText variant="footnote" tone="secondary">{DIAG_INTRO}</AppText>
        <AppText variant="footnote" weight="600" testID="diag-not-verified">{DIAG_NOT_VERIFIED}</AppText>
        {d?.devPreview ? <AppText variant="footnote" weight="600">{DIAG_DEV_PREVIEW}</AppText> : null}
        {d && nums && crit ? (
          <>
            {diagnosticsRows(d, captured).map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <AppText variant="subheadline" tone="secondary" style={{ flex: 1 }}>{r.label}</AppText>
                <AppText variant="subheadline" tabular style={{ flex: 1.3, textAlign: 'right' }}>{r.value}</AppText>
              </View>
            ))}
            <AppText variant="footnote" tone="secondary" accessibilityRole="header">Against the provisional test targets</AppText>
            <AppText variant="footnote" tabular>{`Gaps under ${DEVICE_CRITERIA.maxGapPctOfWindow}% of the window: ${RESULT_TEXT[crit.gapPct]}`}</AppText>
            <AppText variant="footnote" tabular>{`At least ${DEVICE_CRITERIA.minCapturedPctOfWindow}% captured: ${RESULT_TEXT[crit.capturedPct]}`}</AppText>
            <AppText variant="footnote" tabular>{`Battery drain at most ${DEVICE_CRITERIA.maxBatteryDrainPct}%: ${RESULT_TEXT[crit.batteryDrain]}`}</AppText>
            {d.gaps.length > 0 ? (
              <>
                <AppText variant="footnote" tone="secondary" accessibilityRole="header">Gaps</AppText>
                {d.gaps.slice(0, 20).map((g, i) => (
                  <AppText key={i} variant="footnote" tabular>{`${clockFromMs(g.startMs, !!d.devPreview)} to ${clockFromMs(g.endMs, !!d.devPreview)}, ${Math.max(1, Math.round((g.endMs - g.startMs) / 60000))} min: ${gapCauseLabel(g.cause)}`}</AppText>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <AppText variant="subheadline" tone="secondary">{DIAG_NO_RECORD}</AppText>
        )}
        <AppText variant="footnote" tone="secondary">{DIAG_EXPORT_NOTE}</AppText>
        <PrimaryButton label={DIAG_EXPORT} variant="tinted" loading={busy} onPress={() => void doExport()} testID="diag-export" />
        {note ? <AppText variant="footnote" testID="diag-export-note">{note}</AppText> : null}
      </Disclosure>
    </Surface>
  );
}
