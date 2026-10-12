import type { Source } from '../types/evidence';
import { Icon, type IconName } from './Icon';

export type BadgeKind = Source | 'audio-model' | 'sample';

const LABELS: Record<BadgeKind, { icon: IconName; label: string }> = {
  'user-reported': { icon: 'user', label: 'User-reported' },
  'audio-observation': { icon: 'wave', label: 'Audio observation (simple measure)' },
  'audio-model': { icon: 'model', label: 'Audio observation (model)' },
  'app-guidance': { icon: 'info', label: 'App guidance' },
  missing: { icon: 'missing', label: 'Missing' },
  wearable: { icon: 'watch', label: 'Wearable reading' },
  sample: { icon: 'sample', label: 'Sample data' },
};

export function sourceLabel(kind: BadgeKind): string {
  return LABELS[kind].label;
}

export interface SourceBadgeProps {
  kind: BadgeKind;
}

export function SourceBadge({ kind }: SourceBadgeProps) {
  const { icon, label } = LABELS[kind];
  return (
    <span className={`badge badge-${kind === 'sample' ? 'sample' : kind}`}>
      <Icon name={icon} />
      <span>{label}</span>
    </span>
  );
}
