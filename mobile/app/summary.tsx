import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { ERROR_BOUNDARY_MESSAGE, SUMMARY_GENERATED_NOTE, SUMMARY_PRINT_NOT_DIAGNOSIS } from '@core/content/claims';
import { buildSampleNightView } from '@core/night';
import { buildSummary, summaryToHtml, summaryToPlainText } from '@core/mobileLogic/summaryText';
import { useRealNights } from '../src/data/nightSource';
import { useSettings } from '../src/state/settings';
import { AppText } from '../src/ui/AppText';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { LimitsPanel } from '../src/ui/LimitsPanel';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { Skeleton } from '../src/ui/Skeleton';
import { StateCard } from '../src/ui/StateCard';
import { Surface } from '../src/ui/Surface';

/** The web preview has no iOS share sheet; say so instead of a generic failure. */
const WEB_SHARE_NOTE = Platform.OS === 'web' ? 'Sharing needs the iPhone app. This web preview cannot open a share sheet. Nothing was sent.' : null;

export default function SummaryScreen() {
  const s = useSettings();
  const { status, nights } = useRealNights();
  const [useSample, setUseSample] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const built = useMemo(() => {
    if (status !== 'ready') return null;
    try {
      return buildSummary({
        answers: s.answers,
        symptoms: s.symptoms,
        redFlag: s.redFlag,
        partner: s.partner,
        realNights: nights.map((n) => n.view),
        sampleNight: useSample ? buildSampleNightView('snore-episodes') : null,
        generatedAtISO: new Date().toISOString(),
      });
    } catch {
      return 'error' as const;
    }
  }, [status, s.answers, s.symptoms, s.redFlag, s.partner, nights, useSample]);

  const shareText = async () => {
    if (!built || built === 'error') return;
    setShareError(null);
    try {
      await Share.share({ message: summaryToPlainText(built.summary, built.sampleOnly), title: 'SleepSmooth summary (not a diagnosis)' });
    } catch {
      setShareError(WEB_SHARE_NOTE ?? 'The summary could not be shared. Nothing was sent.');
    }
  };

  const sharePdf = async () => {
    if (!built || built === 'error') return;
    setShareError(null);
    setBusy(true);
    let uri: string | null = null;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('unavailable');
      const r = await Print.printToFileAsync({ html: summaryToHtml(built.summary, built.sampleOnly) });
      uri = r.uri;
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'SleepSmooth summary (not a diagnosis)' });
    } catch {
      setShareError(WEB_SHARE_NOTE ?? 'The PDF could not be made or shared. You can share the text version instead.');
    } finally {
      // The temporary PDF holds health information, so it is removed once the share sheet closes.
      try {
        if (uri) new File(uri).delete();
      } catch {
        // Cache files are cleared by iOS as well.
      }
      setBusy(false);
    }
  };

  return (
    <Screen variant="app" top={<BackBar title="Summary to discuss" />}>
      <>
        <StateCard tone="info" icon="doc.text" title={SUMMARY_PRINT_NOT_DIAGNOSIS} body={SUMMARY_GENERATED_NOTE} testID="summary-not-diagnosis" />

        {status === 'loading' || (status === 'ready' && !built) ? (
          <Surface>
            <Skeleton lines={5} />
          </Surface>
        ) : null}

        {status === 'error' || built === 'error' ? <StateCard tone="error" icon="exclamationmark.triangle" title="The summary could not be prepared" body={ERROR_BOUNDARY_MESSAGE} testID="summary-error" /> : null}

        {built && built !== 'error' ? (
          <>
            {nights.length === 0 ? (
              <InsetGroup footer="With no recorded night, the summary says so. You can preview the layout with the labelled sample night, which is never counted as your own result.">
                <ListRow
                  title={useSample ? 'Remove the sample night' : 'Preview with the sample night'}
                  leading={useSample ? 'minus.circle' : 'plus.circle'}
                  onPress={() => setUseSample((v) => !v)}
                  accessibilityRole="button"
                />
              </InsetGroup>
            ) : null}

            {built.summary.sections.map((sec) => (
              <Surface key={sec.id}>
                <View style={{ gap: 6 }}>
                  <AppText variant="headline" accessibilityRole="header">
                    {sec.title}
                  </AppText>
                  <AppText variant="body">{sec.text}</AppText>
                </View>
              </Surface>
            ))}

            <LimitsPanel />

            {shareError ? <StateCard tone="error" icon="exclamationmark.triangle" title="Not shared" body={shareError} testID="share-error" /> : null}
            <View style={{ gap: 8 }}>
              <PrimaryButton label="Share as text" onPress={shareText} />
              <PrimaryButton label={busy ? 'Preparing PDF' : 'Share as PDF'} variant="tinted" onPress={sharePdf} disabled={busy} />
            </View>
            <AppText variant="footnote" tone="secondary">
              Sharing opens the iOS share sheet. SleepSmooth does not send this anywhere itself.
            </AppText>
          </>
        ) : null}
      </>
    </Screen>
  );
}
