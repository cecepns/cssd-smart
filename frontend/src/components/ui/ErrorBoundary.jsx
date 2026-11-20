import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
              <AlertTriangle size={28} />
            </span>
            <h2 className="mt-4 text-base font-black text-slate-900 tracking-tight">
              Terjadi Kendala Memuat Halaman
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Halaman ini mengalami kendala teknis sementara. Anda dapat memuat ulang halaman atau kembali ke beranda aplikasi.
            </p>
            {this.state.error?.message && (
              <div className="mt-3.5 rounded-xl bg-slate-100 p-2.5 text-left text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReload}
                className="w-full sm:w-auto"
              >
                <RefreshCw size={13} />
                <span>Muat Ulang Halaman</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto"
              >
                <Home size={13} />
                <span>Kembali ke Beranda</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
