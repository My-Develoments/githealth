import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Keep internal diagnostics out of the rendered UI.
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="app-error-boundary" role="alert" aria-live="assertive">
        <div className="app-error-boundary__panel">
          <h1>GitHealth is temporarily unavailable</h1>
          <p>The application hit an unexpected UI error. Reload the page to try again.</p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}