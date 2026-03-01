import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary yakaladı:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-zinc-950">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-zinc-50">Bir hata oluştu</h1>
            <p className="text-sm text-zinc-400">
              Uygulama beklenmeyen bir hatayla karşılaştı.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 text-white px-5 py-2 rounded text-sm font-medium
                         hover:bg-emerald-600 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
