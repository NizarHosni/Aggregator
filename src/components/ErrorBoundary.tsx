import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 App Crashed:', error);
    console.error('Error Info:', errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to error tracking service if available
    if (typeof window !== 'undefined') {
      const windowWithSentry = window as typeof window & { Sentry?: { captureException: (error: Error) => void } };
      if (windowWithSentry.Sentry) {
        windowWithSentry.Sentry.captureException(error);
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
          <div className="glass-card-strong rounded-3xl p-8 max-w-2xl w-full shadow-professional-lg">
            <div className="text-center mb-6">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h1 className="text-heading text-2xl mb-2">Something went wrong</h1>
              <p className="text-body">
                We're sorry, but something unexpected happened. Our team has been notified.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={this.handleReload}
                className="btn-primary w-full py-3 text-base"
              >
                Reload Page
              </button>

              <a
                href="/"
                className="btn-secondary w-full py-3 text-base text-center block"
              >
                Go to Homepage
              </a>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <summary className="cursor-pointer text-subheading font-semibold mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="text-xs overflow-auto text-left">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

