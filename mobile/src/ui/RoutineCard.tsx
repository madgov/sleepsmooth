import { View } from 'react-native';
import {
  ROUTINE_DENIED,
  ROUTINE_FIND_BODY,
  ROUTINE_FIND_TITLE,
  ROUTINE_NEED_MORE,
  ROUTINE_NOT_NOW,
  ROUTINE_UNAVAILABLE,
  ROUTINE_USE,
  routineSuggestionLine,
} from '@core/content/claims';
import { formatClock } from '@core/mobileLogic/index';
import { sourceLabel, type RoutineSuggestion } from '@core/mobileLogic/routine';
import type { RoutineStatus } from '../routine';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { GlassCard } from './GlassCard';
import { IconTile } from './IconTile';
import { PrimaryButton } from './PrimaryButton';

export interface RoutineCardViewProps {
  status: RoutineStatus;
  suggestion: RoutineSuggestion | null;
  onFind: () => void;
  onUse: () => void;
  onNotNow: () => void;
  /** Previews label themselves. */
  sample?: boolean;
}

/**
 * The routine card. Idle: explains and offers "Find my routine" (the Motion permission is asked only after that tap).
 * Found: the suggestion with Use / Not now. It never changes the schedule by itself.
 */
export function RoutineCardView({ status, suggestion, onFind, onUse, onNotNow, sample }: RoutineCardViewProps) {
  const found = status === 'found' && suggestion;
  return (
    <GlassCard radius={28} padding={20} testID="routine-card">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <IconTile name="figure.walk" size={48} />
          <AppText variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
            {found ? 'A suggestion for your hours' : ROUTINE_FIND_TITLE}
          </AppText>
        </View>
        {found ? (
          <>
            <AppText variant="body" accessibilityLiveRegion="polite">
              {routineSuggestionLine(formatClock(suggestion.bedMin), formatClock(suggestion.wakeMin), suggestion.nights, suggestion.basis)}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label={sourceLabel(suggestion)} icon={suggestion.basis === 'phone-stillness' ? 'iphone' : 'heart.text.square'} tone="info" />
              {sample ? <Chip label="Sample data" icon="testtube.2" tone="sample" /> : null}
            </View>
            <AppText variant="footnote" tone="secondary">
              Unvalidated. Phone stillness is not the same as sleep, and your schedule only changes if you tap Use this.
            </AppText>
            <View style={{ gap: 4 }}>
              <PrimaryButton label={ROUTINE_USE} onPress={onUse} testID="routine-use" />
              <PrimaryButton label={ROUTINE_NOT_NOW} variant="plain" onPress={onNotNow} testID="routine-not-now" />
            </View>
          </>
        ) : (
          <>
            <AppText variant="subheadline" tone="secondary" accessibilityLiveRegion="polite">
              {status === 'not-enough' ? ROUTINE_NEED_MORE : status === 'denied' ? ROUTINE_DENIED : status === 'unavailable' ? ROUTINE_UNAVAILABLE : status === 'error' ? 'That did not work. Nothing was changed.' : ROUTINE_FIND_BODY}
            </AppText>
            <View style={{ gap: 4 }}>
              <PrimaryButton label={status === 'finding' ? 'Looking' : ROUTINE_FIND_TITLE} loading={status === 'finding'} onPress={onFind} testID="routine-find" />
              {status === 'idle' ? <PrimaryButton label={ROUTINE_NOT_NOW} variant="plain" onPress={onNotNow} testID="routine-not-now" /> : null}
            </View>
          </>
        )}
      </View>
    </GlassCard>
  );
}
