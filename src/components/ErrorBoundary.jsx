import { Component } from 'react';

/**
 * Catches render-time errors so one thrown exception cannot blank the entire
 * app. Previously there was no boundary anywhere: any render error in any page
 * produced a white screen with nothing reported.
 *
 * `onError` is the single hook where an error reporter (Sentry, etc.) should
 * be wired in. It is deliberately not coupled to a vendor here.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, info);
      } catch {
        // A failing reporter must never mask the original error.
      }
    }
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: 'var(--bg-subtle)' }}
          aria-hidden="true"
        >
          ⚠
        </div>

        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Something went wrong on this page
        </h2>

        <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
          The rest of the site is still working. You can retry this section or head back home.
        </p>

        {import.meta.env?.DEV && (
          <pre
            className="text-xs text-left max-w-full overflow-x-auto p-3 rounded-lg font-mono"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--danger)' }}
          >
            {String(error?.stack || error?.message || error)}
          </pre>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-[var(--r-md)] text-sm font-medium cursor-pointer border-none"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-[var(--r-md)] text-sm font-medium no-underline"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}
