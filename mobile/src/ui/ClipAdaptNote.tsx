import { View } from 'react-native';
import { CLIP_ADAPT_NOTE, CLIP_ADAPT_PENDING, CLIP_ADAPT_RESET } from '@core/content/claims';
import { isAdapting } from '@core/mobileLogic/clipAdaptation';
import { useClipAdaptation } from '../clips/useClipAdaptation';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { PressScale } from './Press';

/**
 * One honest line about the feedback adaptation, with Reset. Hidden until the user has reviewed at least one real-night clip.
 * It says what the adaptation does and what it does not do (the night summary is untouched).
 */
export function ClipAdaptNote({ refreshKey = 0, padded = false }: { refreshKey?: number | string; padded?: boolean }) {
  const { colors } = useTheme();
  const { adaptation, reset } = useClipAdaptation(refreshKey);
  if (adaptation.reviewed === 0) return null;
  const active = isAdapting(adaptation);
  return (
    <View style={{ gap: 8, paddingHorizontal: padded ? 16 : 0, paddingBottom: padded ? 12 : 0 }} testID="clip-adapt-note">
      <AppText variant="footnote" tone="secondary" testID="clip-adapt-line">
        {active ? CLIP_ADAPT_NOTE(adaptation.reviewed) : CLIP_ADAPT_PENDING(adaptation.reviewed)}
      </AppText>
      <PressScale onPress={reset} haptic="selection" accessibilityLabel={`${CLIP_ADAPT_RESET} clip feedback`} containerStyle={{ alignSelf: 'flex-start' }} testID="clip-adapt-reset">
        <View style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.separatorOpaque }}>
          <AppText variant="subheadline" weight="600" tone="accent">
            {CLIP_ADAPT_RESET}
          </AppText>
        </View>
      </PressScale>
    </View>
  );
}
