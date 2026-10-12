import { Component, type ReactNode } from 'react';
import { ERROR_BOUNDARY_ACTION, ERROR_BOUNDARY_MESSAGE, ERROR_BOUNDARY_TITLE } from '../content/claims';
import { ErrorState } from './states';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorState title={ERROR_BOUNDARY_TITLE} message={ERROR_BOUNDARY_MESSAGE} actionLabel={ERROR_BOUNDARY_ACTION} onAction={() => window.location.reload()} />;
  }
}
