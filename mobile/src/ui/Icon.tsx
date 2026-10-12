import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { useTheme } from '../theme/useTheme';

export type SymbolName = Extract<SymbolViewProps['name'], string>;

export interface IconProps {
  name: SymbolName;
  size?: number;
  color?: ColorValue;
  weight?: SymbolViewProps['weight'];
  type?: SymbolViewProps['type'];
}

/** Decorative SF Symbol. Hidden from VoiceOver; the parent carries the label. */
export function Icon({ name, size = 20, color, weight = 'regular', type = 'hierarchical' }: IconProps) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={name}
      size={size}
      type={type}
      weight={weight}
      tintColor={color ?? colors.labelSecondary}
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no"
      fallback={<SymbolView name="info.circle" size={size} tintColor={color ?? colors.labelSecondary} style={{ width: size, height: size }} />}
    />
  );
}
