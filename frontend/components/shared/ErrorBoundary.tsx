/**
 * Error Boundary Component
 */

'use client';

import { Component, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error is available in state for rendering
    // Logging disabled to avoid exposing sensitive information in production
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryContent error={this.state.error} onRetry={() => this.setState({ hasError: false })} />
      );
    }

    return this.props.children;
  }
}

// Separate functional component for using hooks
function ErrorBoundaryContent({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text-primary mb-4">
          {t('ui:error.title', '出错了')}
        </h1>
        <p className="text-text-secondary mb-4">
          {error?.message || t('ui:error.unknown', '发生了一个未知错误')}
        </p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-info text-white rounded-md hover:opacity-90 transition-opacity"
        >
          {t('ui:error.retry', '重试')}
        </button>
      </div>
    </div>
  );
}
