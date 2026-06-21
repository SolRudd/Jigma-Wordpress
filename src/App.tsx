import JigmaBuilder from "./components/JigmaBuilder.tsx";
import { Component, type ErrorInfo, type ReactNode } from "react";

class BuilderErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Jigma workspace failed to render", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="workspace-error" role="alert">
          <h1>Jigma workspace could not render</h1>
          <p>{this.state.error.message || "Refresh the page and try again."}</p>
        </section>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <main className="app-shell">
      <BuilderErrorBoundary>
        <JigmaBuilder />
      </BuilderErrorBoundary>
    </main>
  );
}
