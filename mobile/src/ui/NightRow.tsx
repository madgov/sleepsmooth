import { View } from 'react-native';
import { AUDIO_DETAIL, DISCLAIMER_CANNOT_RULE_OUT, MODEL_NOT_APPLICABLE, NO_MODEL_LINE } from '@core/content/claims';
import { spokenDuration } from '@core/mobileLogic/index';
import { COPY } from '../content/copy';
import type { NightAudioState, NightListItem } from '../data/nightSource';
import { useTheme } from '../theme/useTheme';
import type { ToneName } from '../theme/tokens';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { Icon, type SymbolName } from './Icon';
import { PressScale } from './Press';
import { SourceBadge } from './SourceBadge';
import { Surface } from './Surface';

export interface NightPresentation {
  line: string;
  second?: string;
  icon: SymbolName;
  tone: Exclude<ToneName, 'default'>;
  /** L3 emphasis (discuss), plain L2, or dashed missing. */
  border: 'discuss' | 'plain' | 'missing';
}

/** Table 4.4. Never green; "few observations" is info blue and carries the cannot-rule-out sentence on the row itself. */
export function presentationFor(state: NightAudioState, reasons: readonly string[] = []): NightPresentation | null {
  switch (state) {
    case 'snore-like-observed':
      return { line: AUDIO_DETAIL.usableSnoreLikeObserved, icon: 'waveform', tone: 'discuss', border: 'discuss' };
    case 'few-observations':
      return { line: AUDIO_DETAIL.usableFewObservations, second: DISCLAIMER_CANNOT_RULE_OUT, icon: 'waveform', tone: 'info', border: 'plain' };
    case 'not-assessed':
      return { line: `${COPY.N59_NOT_ASSESSED}${reasons[0] ? `. ${reasons[0]}` : ''}`, second: DISCLAIMER_CANNOT_RULE_OUT, icon: 'circle.dashed', tone: 'missing', border: 'missing' };
    case 'model-not-applicable':
      return { line: MODEL_NOT_APPLICABLE, second: DISCLAIMER_CANNOT_RULE_OUT, icon: 'circle.dashed', tone: 'missing', border: 'missing' };
    case 'no-model':
      return { line: `${AUDIO_DETAIL.noModel} ${NO_MODEL_LINE}`, second: DISCLAIMER_CANNOT_RULE_OUT, icon: 'waveform', tone: 'info', border: 'plain' };
    case 'not-recorded':
      return null;
  }
}

const DATE_FMT = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
export const nightTitle = (n: NightListItem): string => new Date(n.dateISO).toLocaleDateString('en-US', DATE_FMT).replace(',', ',');
const LONG_FMT = { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' } as const;

export function NightRow({ night, onPress, testID }: { night: NightListItem; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  const p = presentationFor(night.state, night.notAssessedReasons);
  if (!p) return null;
  const h = Math.floor(night.recordedMinutes / 60);
  const m = night.recordedMinutes % 60;
  const d = new Date(night.dateISO);
  const spoken = `${night.isSample ? 'Sample data. ' : ''}${d.toLocaleDateString('en-US', LONG_FMT)}, recorded ${spokenDuration(night.recordedMinutes)}, ${p.line} ${COPY.N01_NOT_A_DIAGNOSIS}.`;
  return (
    <PressScale testID={testID} accessibilityLabel={spoken} onPress={onPress}>
      <Surface radius="xl" padding={16} level={p.border === 'discuss' ? 'L3' : 'L2'} tone={p.border === 'discuss' ? 'discuss' : 'default'} source={night.isSample ? 'sample' : p.border === 'missing' ? 'missing' : undefined}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 54, height: 58, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
              <AppText variant="caption1" weight="700" tone="accent" maxFontSizeMultiplier={1.2}>
                {d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}
              </AppText>
              <AppText variant="title2" tabular weight="700" maxFontSizeMultiplier={1.2}>
                {d.getUTCDate()}
              </AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="headline">{d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}</AppText>
              <AppText variant="subheadline" tone="secondary" tabular>
                {COPY.N58_RECORDED(h, m)}
              </AppText>
            </View>
            <Icon name="chevron.right" size={14} color={colors.labelTertiary} weight="semibold" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {night.isSample ? <SourceBadge kind="sample" size="compact" /> : null}
            <Chip label={shortLine(night.state)} tone={p.tone} icon={p.icon} />
          </View>
          {p.second ? (
            <AppText variant="footnote" tone="secondary">
              {p.second}
            </AppText>
          ) : null}
        </View>
      </Surface>
    </PressScale>
  );
}

const shortLine = (st: NightListItem['state']): string =>
  st === 'snore-like-observed' ? 'Snore-like sounds observed' : st === 'few-observations' ? 'Few observations' : st === 'not-assessed' ? 'Not assessed' : st === 'model-not-applicable' ? 'Model not applicable' : st === 'no-model' ? 'No model on this build' : 'Not recorded';
