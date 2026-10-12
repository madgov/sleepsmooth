import { SYNTHETIC_LABEL } from '../content/claims';
import { Icon } from './Icon';

export interface DemoBannerProps {
  isSynthetic: boolean;
}

/** Renders whenever the data on screen is synthetic. Renders nothing otherwise. */
export function DemoBanner({ isSynthetic }: DemoBannerProps) {
  if (!isSynthetic) return null;
  return (
    <div className="banner" role="note" aria-label="Sample data notice">
      <span className="banner-icon"><Icon name="sample" /></span>
      <span>{SYNTHETIC_LABEL} data. This is an example, not your information.</span>
    </div>
  );
}
