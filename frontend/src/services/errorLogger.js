/**
 * errorLogger.js — Silently logs frontend errors to Firestore `errorLogs` collection.
 * This module MUST never throw — any failure is silently swallowed to avoid
 * the logger itself crashing the app.
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Deduplicate: don't log the same error message more than once per session
const loggedThisSession = new Set();

/**
 * Log an error to Firestore.
 * @param {Error|string} error - The error object or message
 * @param {string} context - Where the error occurred (e.g. 'StudentDashboard')
 * @param {string} [stack] - Optional component stack from ErrorBoundary
 */
export const logError = async (error, context = 'Unknown', stack = null) => {
    try {
        const message = error?.message || String(error);
        const dedupeKey = `${context}:${message}`;

        // Skip if already logged this session
        if (loggedThisSession.has(dedupeKey)) return;
        loggedThisSession.add(dedupeKey);

        // Skip trivial/expected errors
        const ignoredPatterns = [
            'ResizeObserver loop',
            'Non-Error promise rejection',
            'Script error',
            'no-speech',
            'aborted',
        ];
        if (ignoredPatterns.some(p => message.includes(p))) return;

        await addDoc(collection(db, 'errorLogs'), {
            message,
            stack: error?.stack || stack || null,
            context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Timestamp.now(),
            resolved: false,
        });
    } catch {
        // Intentionally silent — logger must never crash the app
    }
};

/**
 * Log a global window error (from window.onerror).
 */
export const logGlobalError = async (message, source, lineno, error) => {
    try {
        const dedupeKey = `global:${message}`;
        if (loggedThisSession.has(dedupeKey)) return;
        loggedThisSession.add(dedupeKey);

        await addDoc(collection(db, 'errorLogs'), {
            message: String(message),
            stack: error?.stack || `${source}:${lineno}` || null,
            context: 'window.onerror',
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Timestamp.now(),
            resolved: false,
        });
    } catch {
        // Intentionally silent
    }
};

/**
 * Log an unhandled promise rejection.
 */
export const logUnhandledRejection = async (reason) => {
    try {
        const message = reason?.message || String(reason);
        const dedupeKey = `promise:${message}`;
        if (loggedThisSession.has(dedupeKey)) return;
        loggedThisSession.add(dedupeKey);

        // Skip known benign rejections
        if (['no-speech', 'aborted', 'Network request failed'].some(p => message.includes(p))) return;

        await addDoc(collection(db, 'errorLogs'), {
            message,
            stack: reason?.stack || null,
            context: 'UnhandledPromiseRejection',
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Timestamp.now(),
            resolved: false,
        });
    } catch {
        // Intentionally silent
    }
};
