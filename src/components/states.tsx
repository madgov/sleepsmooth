import type { CSSProperties } from 'react';
import { Icon } from './Icon';

export interface ErrorStateProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function ErrorState({ title, message, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className="state state-error" role="alert">
      <h3><Icon name="alert" /> {title}</h3>
      <p>{message}</p>
      <button type="button" className="btn" onClick={onAction}>{actionLabel}</button>
    </div>
  );
}

export interface LoadingStateProps {
  label: string;
  /** 0 to 1. Omit for an indeterminate wait. */
  progress?: number;
}

export function LoadingState({ label, progress }: LoadingStateProps) {
  const determinate = typeof progress === 'number';
  const value = determinate ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : undefined;
  return (
    <div className="state" role="status" aria-live="polite">
      <p>{label}</p>
      {/* Native progress stays for assistive tech; the visible bar moves by transform only. */}
      <progress className="sr-only" aria-label={label} max={100} value={value} />
      <div className={`progress-track${determinate ? '' : ' progress-indeterminate'}`} aria-hidden="true">
        <div className="progress-fill" style={determinate ? ({ '--p': (value ?? 0) / 100 } as CSSProperties) : undefined} />
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="state state-empty">
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-secondary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
