export interface StepperProps {
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <nav aria-label="Progress">
      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? 'step' : undefined} className={i < current ? 'step-done' : undefined}>
            <span>
              {s}
              {i < current && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
