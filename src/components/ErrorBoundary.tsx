import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CineTrack ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬💥</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)',
            marginBottom: '20px', maxWidth: '320px' }}>
            This page hit an unexpected error. Try refreshing, 
            or go back and try again.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={this.handleReset} style={{
              padding: '10px 20px', background: 'var(--color-brand)',
              color: 'var(--text-on-brand)', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer',
            }}>Try Again</button>
            <button onClick={() => window.location.href = '/'} style={{
              padding: '10px 20px', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer',
            }}>Go Home</button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '24px', padding: '12px', background: '#1a1a1a',
              color: '#ff6b6b', fontSize: '11px', borderRadius: '8px',
              maxWidth: '600px', overflow: 'auto', textAlign: 'left',
            }}>
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
