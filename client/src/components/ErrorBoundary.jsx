import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <AlertTriangle size={32} />
          <p>{this.props.fallbackTitle || 'Simulation Failed'}</p>
          <p>{this.props.fallbackMessage || 'Something went wrong rendering this component. Try running the backtest again.'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
