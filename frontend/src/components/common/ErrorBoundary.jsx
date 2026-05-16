import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI render error:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
              {this.props.fallback || 'Something went wrong rendering this panel.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono">
              {String(this.state.error.message || this.state.error)}
            </p>
            <button
              onClick={this.reset}
              className="text-xs px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
