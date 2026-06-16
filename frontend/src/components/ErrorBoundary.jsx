import React from 'react';
import { logError } from '../services/errorLogger';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught error:', error, info);
    this.setState({ info });
    // Log to Firestore for Admin monitoring
    logError(error, this.props.context || 'ErrorBoundary', info?.componentStack);


    // Check if it's a "Failed to fetch dynamically imported module" error
    // This often happens when a new version is deployed and the browser tries to load an old chunk
    const isChunkLoadFailed = error?.name === 'ChunkLoadError' ||
      (error?.message && (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('loading chunk') ||
        error.message.includes('Importing a module script failed')
      ));

    if (isChunkLoadFailed) {
      console.log('Detected chunk load failure. Attempting automatic reload...');

      // Save to sessionStorage to avoid infinite reload loops
      const lastReload = sessionStorage.getItem('last-chunk-reload');
      const now = Date.now();

      // Only auto-reload if we haven't reloaded in the last 10 seconds
      if (!lastReload || (now - parseInt(lastReload)) > 10000) {
        sessionStorage.setItem('last-chunk-reload', now.toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.mini) {
        return (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px dashed #ef4444',
            borderRadius: '12px',
            color: '#fca5a5',
            fontSize: '13px',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>⚠️ Failed to load {this.props.context || 'component'}</p>
            <p style={{ margin: '0 0 12px 0', fontSize: '11px', opacity: 0.8 }}>
              {this.state.error?.message || String(this.state.error)}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null, info: null })}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              🔄 Retry
            </button>
          </div>
        );
      }

      return (
        <div style={{
          padding: 30,
          fontFamily: 'sans-serif',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
          color: 'white',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ color: '#ef4444' }}>⚠️ Something went wrong</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)' }}>An unexpected error occurred in the application.</p>
          <details style={{
            whiteSpace: 'pre-wrap',
            background: 'rgba(0,0,0,0.3)',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '12px',
            marginTop: '20px',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>View Error Details</summary>
            {this.state.error && this.state.error.toString()}
            {this.state.info && this.state.info.componentStack}
          </details>
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🔄 Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
