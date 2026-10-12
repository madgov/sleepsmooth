import { Icon } from './Icon';
import { DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT, DISCLAIMER_NOT_DIAGNOSIS, DISCLAIMER_SEEK_CARE, PROTOTYPE_BANNER } from '../content/claims';

export interface DisclaimerProps {
  /** 'banner' = short top-of-page strip; 'full' = complete safety text. */
  variant?: 'banner' | 'full';
  includeAudio?: boolean;
}

export function Disclaimer({ variant = 'full', includeAudio = false }: DisclaimerProps) {
  if (variant === 'banner') {
    return (
      <div className="banner banner-prototype" role="note">
        <span className="banner-icon"><Icon name="info" /></span>
        <span>{PROTOTYPE_BANNER}</span>
      </div>
    );
  }
  return (
    <aside className="disclaimer" aria-label="Important information">
      <p><strong>{PROTOTYPE_BANNER}</strong></p>
      <p>{DISCLAIMER_NOT_DIAGNOSIS}</p>
      {includeAudio && <p>{DISCLAIMER_AUDIO} {DISCLAIMER_CANNOT_RULE_OUT}</p>}
      <p>{DISCLAIMER_SEEK_CARE}</p>
    </aside>
  );
}
