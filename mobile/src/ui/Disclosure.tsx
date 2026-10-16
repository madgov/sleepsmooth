import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { CSS_EASE_OUT, EASE_IN_OUT } from './motion';

/** M7: layout animation on the container, chevron rotates via CSS transition. Reduce Motion: instant plus a short fade. */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const { colors, reduceMotion } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(250).easing(EASE_IN_OUT)} style={{ overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: pressed ? colors.fill : 'transparent' })}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body">{title}</AppText>
        </View>
        <Animated.View style={{ transform: [{ rotate: open && !reduceMotion ? '90deg' : '0deg' }], transitionProperty: 'transform', transitionDuration: 200, transitionTimingFunction: CSS_EASE_OUT }}>
          <Icon name={open && reduceMotion ? 'chevron.down' : 'chevron.right'} size={14} color={colors.labelTertiary} weight="semibold" />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(reduceMotion ? 150 : 200)} exiting={FadeOut.duration(120)} style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
