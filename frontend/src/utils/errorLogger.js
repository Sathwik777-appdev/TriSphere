/**
 * Error Logging Service
 * Centralized error tracking and logging
 */

class ErrorLogger {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.initGlobalHandlers();
  }

  initGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.log({
        type: 'unhandled_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log({
        type: 'unhandled_rejection',
        message: event.reason?.message || 'Promise rejected',
        error: event.reason?.stack
      });
    });
  }

  log(errorInfo) {
    const entry = {
      ...errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    this.errors.push(entry);

    // Keep only last N errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error logged:', entry);
    }

    // Backend-side error reporting (e.g. Sentry / a custom errorLogs
    // endpoint) is intentionally not enabled by default. Critical
    // path errors already write to the `errorLogs` Firestore
    // collection via firestoreService — this in-memory store is
    // for client-only diagnostics surfaced through getErrors().
  }

  logError(error, context = {}) {
    this.log({
      type: 'application_error',
      message: error.message,
      stack: error.stack,
      context
    });
  }

  logFirebaseError(error, operation = 'unknown') {
    this.log({
      type: 'firebase_error',
      operation,
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  logAPIError(error, endpoint = 'unknown') {
    this.log({
      type: 'api_error',
      endpoint,
      status: error.status,
      message: error.message,
      response: error.response
    });
  }

  getErrors() {
    return this.errors;
  }

  getRecentErrors(count = 10) {
    return this.errors.slice(-count);
  }

  clearErrors() {
    this.errors = [];
  }

  exportErrors() {
    return JSON.stringify(this.errors, null, 2);
  }

  // Optional backend forwarder. Left as a no-op by default — callers
  // that need centralized error aggregation should wire this up
  // explicitly (Sentry SDK / a Cloud Function endpoint / etc.).
  async sendToBackend(errorEntry) {
    // No-op until a backend logging sink is wired in.
  }
}

// Export singleton
export const errorLogger = new ErrorLogger();

// Convenience functions
export const logError = (error, context) => errorLogger.logError(error, context);
export const logFirebaseError = (error, operation) => errorLogger.logFirebaseError(error, operation);
export const logAPIError = (error, endpoint) => errorLogger.logAPIError(error, endpoint);
