import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full surface rounded-2xl p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-orange-50 text-2xl font-black text-orange-600">!</div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-teal-600">XccessoriesPoint</p>
            <h1 className="text-xl font-black text-slate-900 mb-2">
              We hit a snag
            </h1>
            <p className="text-sm text-slate-500 mb-6 break-words">
              {this.state.error.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ error: null })}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-lg border border-slate-300 font-semibold hover:bg-slate-50"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
