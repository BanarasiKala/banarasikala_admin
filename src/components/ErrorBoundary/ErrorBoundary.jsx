import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] px-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <iconify-icon 
                icon="lucide:alert-triangle" 
                className="text-6xl text-[#800020]"
                aria-label="Error icon"
              ></iconify-icon>
            </div>
            <h1 className="text-3xl font-bold text-[#800020] mb-4 brand-font">
              Something Went Wrong
            </h1>
            <p className="text-[#3D2817]/70 mb-8">
              We apologize for the inconvenience. Please try again.
            </p>
            
            {this.state.error && (
              <div className="bg-white/50 p-4 rounded-lg mb-6 text-left overflow-auto max-h-40">
                <p className="text-xs text-red-600 font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-[#800020] text-white font-bold uppercase tracking-widest rounded-lg hover:bg-[#6b001a] transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 border-2 border-[#800020] text-[#800020] font-bold uppercase tracking-widest rounded-lg hover:bg-[#800020] hover:text-white transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
