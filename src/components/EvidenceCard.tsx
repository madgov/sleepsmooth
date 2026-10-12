import type { EvidenceItem, EvidenceState } from '../types/evidence';
import { SourceBadge } from './SourceBadge';

const STATE_TEXT: Record<EvidenceState, string> = {
  present: 'Observed or reported',
  'absent-unreliable': 'Not seen here (this does not rule anything out)',
  inconclusive: 'Inconclusive',
  missing: 'Not provided',
  conflict: 'Signals differ',
};

export interface EvidenceCardProps {
  item: EvidenceItem;
  /** Limitations already shown once for the whole section; not repeated on this card. */
  hideLimitations?: readonly string[];
}

export function EvidenceCard({ item, hideLimitations = [] }: EvidenceCardProps) {
  const limits = item.limitations.filter((l) => !hideLimitations.includes(l));
  const headingId = `ev-${item.id}`;
  return (
    <article className="card" aria-labelledby={headingId}>
      <div className="card-header">
        <SourceBadge kind={item.source} />
        {item.isSynthetic && <SourceBadge kind="sample" />}
        <span className="card-state">{STATE_TEXT[item.state]}</span>
      </div>
      <h4 id={headingId}>{item.label}</h4>
      <p>{item.detail}</p>
      {limits.length > 0 && (
        <ul aria-label="Limitations">
          {limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {item.citation && <p className="card-citation">Source: {item.citation}</p>}
    </article>
  );
}
