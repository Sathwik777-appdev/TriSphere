/**
 * Production-safe Logger Utility
 * Provides environment-aware logging that silences debug logs in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Logger object with methods for different log levels
 * In production, only warn and error are logged
 */
export const logger = {
    /**
     * Debug logging - only shows in development
     * Use for detailed debugging information
     */
    debug: (...args) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Info logging - only shows in development
     * Use for general information
     */
    info: (...args) => {
        if (isDevelopment) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Log - only shows in development (alias for info)
     * Use as a direct replacement for console.log
     */
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    /**
     * Warning logging - shows in all environments
     * Use for potential issues that don't break functionality
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error logging - shows in all environments
     * Use for errors and failures
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Performance logging - only in development
     * Use for timing and performance measurements
     */
    perf: (label, startTime) => {
        if (isDevelopment) {
            const duration = performance.now() - startTime;
            console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
        }
    },

    /**
     * Group logging - only in development
     * Use for grouped console output
     */
    group: (label) => {
        if (isDevelopment) {
            console.group(label);
        }
    },

    groupEnd: () => {
        if (isDevelopment) {
            console.groupEnd();
        }
    },

    /**
     * Table logging - only in development
     * Use for displaying tabular data
     */
    table: (data) => {
        if (isDevelopment) {
            console.table(data);
        }
    }
};

export default logger;
