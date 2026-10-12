import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { shouldStack } from '@core/mobileLogic/index';
import { useTheme } from '../theme/useTheme';
import type { ToneName } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';
import { Surface } from './Surface';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  /** Small status element under the subtitle (a Chip). */
  below?: ReactNode;
  leading?: SymbolName | ReactNode;
  leadingTint?: string;
  trailing?: 'chevron' | 'chevronUpDown' | ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio' | 'link' | 'text';
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean };
  testID?: string;
}

/** One list row. minHeight 44, grows with content, stacks label and value at large Dynamic Type. */
export function ListRow(p: ListRowProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stack = shouldStack(fontScale);
  const pressable = !!p.onPress && !p.disabled;
  const label = p.accessibilityLabel ?? [p.title, p.value, p.subtitle].filter(Boolean).join(', ');

  const leading =
    typeof p.leading === 'string' ? <Icon name={p.leading as SymbolName} size={22} color={p.destructive ? colors.destructive : (p.leadingTint ?? colors.accent)} /> : p.leading;
  const trailing =
    p.trailing === 'chevron' ? (
      <Icon name="chevron.right" size={14} color={colors.labelTertiary} weight="semibold" />
    ) : p.trailing === 'chevronUpDown' ? (
      <Icon name="chevron.up.chevron.down" size={14} color={colors.labelTertiary} weight="semibold" />
    ) : (
      p.trailing
    );

  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
      {leading ? <View accessible={false}>{leading}</View> : null}
      <View style={{ flex: 1, flexDirection: stack ? 'column' : 'row', alignItems: stack ? 'flex-start' : 'center', gap: stack ? 2 : 12 }}>
        <View style={{ flexShrink: 1, flexGrow: 1 }}>
          <AppText variant="body" tone={p.destructive ? 'destructive' : 'label'}>
            {p.title}
          </AppText>
          {p.subtitle ? (
            <AppText variant="subheadline" tone="secondary">
              {p.subtitle}
            </AppText>
          ) : null}
          {p.below ? <View style={{ marginTop: 6 }}>{p.below}</View> : null}
        </View>
        {p.value ? (
          <AppText variant="body" tone="secondary" tabular style={stack ? undefined : { textAlign: 'right', flexShrink: 1 }}>
            {p.value}
          </AppText>
        ) : null}
      </View>
      {trailing ? <View accessible={false}>{trailing}</View> : null}
    </View>
  );

  if (!pressable) {
    return (
      <View accessible accessibilityRole={p.accessibilityRole === 'button' ? undefined : p.accessibilityRole} accessibilityLabel={label} accessibilityState={p.accessibilityState} testID={p.testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={p.onPress}
      accessibilityRole={p.accessibilityRole ?? 'button'}
      accessibilityLabel={label}
      accessibilityHint={p.accessibilityHint}
      accessibilityState={{ selected: p.selected, ...p.accessibilityState }}
      testID={p.testID}
      // M2: background-only press feedback, instant in, short ease-out out (transition handled by the OS highlight; no scale in lists).
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}

/** iOS grouped-list section header: caps footnote in the secondary colour. One style for every section. */
export function GroupHeader({ children }: { children: string }) {
  return (
    <AppText variant="footnote" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: 16, letterSpacing: 0.3 }}>
      {children.toUpperCase()}
    </AppText>
  );
}

export interface InsetGroupProps {
  header?: string;
  footer?: string | ReactNode;
  tone?: ToneName;
  children?: ReactNode;
  testID?: string;
}

/** Inset grouped list: radius md container, hairline separators inset 16 from the leading edge. */
export function InsetGroup({ header, footer, tone = 'default', children, testID }: InsetGroupProps) {
  const { colors } = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID} style={{ gap: 8 }}>
      {header ? (
        <GroupHeader>{header}</GroupHeader>
      ) : null}
      <Surface radius="lg" padding={0} tone={tone} level="L2">
        {items.map((child, i) => (
          <Fragment key={isValidElement(child) && child.key ? child.key : i}>
            {child}
            {i < items.length - 1 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 }} /> : null}
          </Fragment>
        ))}
      </Surface>
      {footer ? (
        typeof footer === 'string' ? (
          <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 16 }}>
            {footer}
          </AppText>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>{footer}</View>
        )
      ) : null}
    </View>
  );
}
