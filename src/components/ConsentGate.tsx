import { useId, type ReactNode } from 'react';

export interface ConsentGateProps {
  title: string;
  description: string;
  checkboxLabel: string;
  granted: boolean;
  onChange: (granted: boolean) => void;
  /** Rendered only while consent is granted. */
  children?: ReactNode;
}

export function ConsentGate({ title, description, checkboxLabel, granted, onChange, children }: ConsentGateProps) {
  const id = useId();
  return (
    <section className="consent" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`}>{title}</h3>
      <p id={`${id}-d`}>{description}</p>
      <label>
        <input type="checkbox" checked={granted} onChange={(e) => onChange(e.target.checked)} aria-describedby={`${id}-d`} />
        <span>{checkboxLabel}</span>
      </label>
      {granted && children}
    </section>
  );
}
