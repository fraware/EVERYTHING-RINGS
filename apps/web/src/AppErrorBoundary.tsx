import { Component, type ReactNode } from "react";

export function AppFailureFallback({ onReload }: { readonly onReload: () => void }) {
  return <main className="consumer-shell consumer-stage">
    <p className="consumer-mark">EVERYTHING RINGS</p>
    <p className="consumer-kicker">SESSION INTERRUPTED</p>
    <h1 role="alert">This session hit an unexpected browser error.</h1>
    <p className="consumer-tip">Reload the page to restart cleanly. No microphone recording has been uploaded.</p>
    <button className="consumer-primary" onClick={onReload}>RELOAD</button>
  </main>;
}

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly failed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <AppFailureFallback onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
