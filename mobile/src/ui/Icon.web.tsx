// Web preview only (dev tool): maps SF Symbol names to @expo/vector-icons so the browser render looks right.
// On iOS Icon.tsx draws the real SF Symbol. Unknown names fall back to a neutral circle so a missing mapping is visible in review.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useTheme } from '../theme/useTheme';

export type SymbolName = string;

export interface IconProps {
  name: SymbolName;
  size?: number;
  color?: ColorValue;
  weight?: string;
  type?: string;
}

type Ion = keyof typeof Ionicons.glyphMap;
type Mci = keyof typeof MaterialCommunityIcons.glyphMap;
const ION: Record<string, Ion> = {
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'chevron.down': 'chevron-down',
  'chevron.up.chevron.down': 'swap-vertical',
  checkmark: 'checkmark',
  'checkmark.circle': 'checkmark-circle-outline',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.square.fill': 'checkbox',
  circle: 'ellipse-outline',
  'circle.fill': 'ellipse',
  'circle.dashed': 'ellipse-outline',
  'largecircle.fill.circle': 'radio-button-on',
  'info.circle': 'information-circle-outline',
  'questionmark.circle': 'help-circle-outline',
  'person.crop.circle.badge.questionmark': 'person-circle-outline',
  'exclamationmark.triangle': 'warning-outline',
  'exclamationmark.circle': 'alert-circle-outline',
  hourglass: 'hourglass-outline',
  clock: 'time-outline',
  calendar: 'calendar-outline',
  bell: 'notifications-outline',
  'bell.slash': 'notifications-off-outline',
  mic: 'mic-outline',
  'mic.slash': 'mic-off-outline',
  'mic.fill': 'mic',
  stop: 'stop-outline',
  'stop.fill': 'stop',
  'play.fill': 'play',
  ellipsis: 'ellipsis-horizontal',
  'moon.zzz': 'moon-outline',
  'moon.stars': 'moon',
  'moon.stars.fill': 'moon',
  moon: 'moon-outline',
  'lock.shield': 'shield-checkmark-outline',
  'list.clipboard': 'clipboard-outline',
  'list.bullet': 'list',
  'list.bullet.rectangle': 'reader-outline',
  'list.bullet.rectangle.fill': 'reader',
  checklist: 'checkbox-outline',
  'doc.text': 'document-text-outline',
  'doc.text.fill': 'document-text',
  iphone: 'phone-portrait-outline',
  trash: 'trash-outline',
  link: 'link-outline',
  gearshape: 'settings-outline',
  'gearshape.fill': 'settings',
  'wrench.and.screwdriver': 'construct-outline',
  'square.grid.2x2': 'grid-outline',
  'square.grid.2x2.fill': 'grid',
  'person.2': 'people-outline',
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  magnifyingglass: 'search-outline',
  'minus.circle': 'remove-circle-outline',
  'testtube.2': 'flask-outline',
  'person.text.rectangle': 'id-card-outline',
  'house.fill': 'home',
  house: 'home-outline',
  'chart.bar.fill': 'bar-chart',
  'chart.bar': 'bar-chart-outline',
  'heart.text.square': 'heart-outline',
  'stethoscope': 'medkit-outline',
  'bed.double': 'bed-outline',
  'bed.double.fill': 'bed',
  'figure.walk': 'walk-outline',
  'sparkles': 'sparkles-outline',
  'hand.raised': 'hand-left-outline',
  'lock': 'lock-closed-outline',
  'square.and.arrow.up': 'share-outline',
  'arrow.right': 'arrow-forward',
  'xmark': 'close',
  'face.smiling': 'happy-outline',
  'cup.and.saucer': 'cafe-outline',
  'eye': 'eye-outline',
  'bolt': 'flash-outline',
  'bolt.fill': 'flash',
  'exclamationmark.bubble': 'chatbubble-ellipses-outline',
  'person.fill': 'person',
  'person': 'person-outline',
  'ruler': 'resize-outline',
  'scalemass': 'barbell-outline',
  'calendar.badge.clock': 'calendar-outline',
  'questionmark.bubble': 'chatbubble-outline',
  'pills': 'medkit-outline',
  'drop': 'water-outline',
  'headphones': 'headset-outline',
  'sun.max': 'sunny-outline',
  'sunrise.fill': 'partly-sunny',
  'powerplug': 'battery-charging-outline',
  'globe': 'globe-outline',
  'building.columns': 'business-outline',
};
const MCI: Record<string, Mci> = {
  waveform: 'waveform',
  'waveform.path': 'waveform',
  'waveform.slash': 'waveform',
  'lungs': 'lungs',
  'sleep': 'sleep',
};

export function Icon({ name, size = 20, color }: IconProps) {
  const { colors } = useTheme();
  const c = (color ?? colors.labelSecondary) as string;
  const mci = MCI[name];
  if (mci) return <MaterialCommunityIcons name={mci} size={size} color={c} />;
  const known = ION[name];
  if (!known && __DEV__) console.warn(`Icon.web: no web mapping for SF Symbol "${name}"`);
  return <Ionicons name={known ?? 'ellipse-outline'} size={size} color={c} />;
}
