import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { reportError } from '../lib/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      source: 'react_error_boundary',
      component: (info.componentStack || '').slice(0, 180)
    })
  }

  private retry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="page" role="alert">
        <div className="container narrow" style={{ paddingBlock: 64, textAlign: 'center', display: 'grid', gap: 16, justifyItems: 'center' }}>
          <h1>Something went wrong</h1>
          <p className="muted-copy">The page hit an unexpected error. You can try again or go back home.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="button button-primary" onClick={this.retry}>Try again</button>
            <Link to="/" className="button button-secondary" onClick={this.retry}>Back home</Link>
          </div>
        </div>
      </div>
    )
  }
}
