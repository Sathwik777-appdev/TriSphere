import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Toast Context for global toast notifications
 */
const ToastContext = createContext(null);

// Toast types with their colors
const TOAST_TYPES = {
    success: {
        bg: '#d1fae5',
        border: '#10b981',
        color: '#065f46',
        icon: '✅'
    },
    error: {
        bg: '#fee2e2',
        border: '#ef4444',
        color: '#991b1b',
        icon: '❌'
    },
    warning: {
        bg: '#fef3c7',
        border: '#f59e0b',
        color: '#92400e',
        icon: '⚠️'
    },
    info: {
        bg: '#dbeafe',
        border: '#3b82f6',
        color: '#1e40af',
        icon: 'ℹ️'
    }
};

/**
 * Toast Provider - Wrap your app with this
 */
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // Inject animation styles safely during component mount
    useEffect(() => {
        if (typeof document !== 'undefined' && !document.querySelector('#toast-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-animation';
            style.textContent = `
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideOutRight {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(100%); }
                }
                @media (max-width: 600px) {
                    .toast-container-mobile {
                        left: 12px !important;
                        right: 12px !important;
                        width: calc(100% - 24px) !important;
                        max-width: none !important;
                    }
                    .toast-mobile {
                        width: 100% !important;
                        min-width: 0 !important;
                        align-items: flex-start !important;
                        padding: 16px !important;
                    }
                    .toast-message-mobile {
                        display: block !important;
                        width: 100% !important;
                        flex: 1 !important;
                        word-break: normal !important;
                        overflow-wrap: break-word !important;
                        white-space: normal !important;
                        text-align: left !important;
                        line-height: 1.5 !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration),
        warning: (message, duration) => addToast(message, 'warning', duration),
        info: (message, duration) => addToast(message, 'info', duration),
        remove: removeToast
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

/**
 * Toast Container - Renders all active toasts
 */
const ToastContainer = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div style={styles.container} className="toast-container-mobile">
            {toasts.map((toast, index) => (
                <Toast
                    key={toast.id}
                    {...toast}
                    onRemove={() => onRemove(toast.id)}
                    index={index}
                />
            ))}
        </div>
    );
};

/**
 * Individual Toast component
 */
const Toast = ({ message, type, onRemove, index }) => {
    const typeStyle = TOAST_TYPES[type] || TOAST_TYPES.info;

    return (
        <div
            className="toast-mobile"
            style={{
                ...styles.toast,
                backgroundColor: typeStyle.bg,
                borderColor: typeStyle.border,
                color: typeStyle.color,
                animation: 'slideInRight 0.3s ease-out',
                animationDelay: `${index * 0.1}s`
            }}
        >
            <span style={styles.icon}>{typeStyle.icon}</span>
            <span style={styles.message} className="toast-message-mobile">{message}</span>
            <button
                onClick={onRemove}
                style={{
                    ...styles.closeBtn,
                    color: typeStyle.color
                }}
            >
                ✕
            </button>
        </div>
    );
};

/**
 * Hook to use toast in any component
 */
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const styles = {
    container: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '400px',
        pointerEvents: 'none'
    },
    toast: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '10px',
        border: '1px solid',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        pointerEvents: 'auto',
        minWidth: '280px'
    },
    icon: {
        fontSize: '18px',
        flexShrink: 0
    },
    message: {
        flex: 1,
        fontSize: '14px',
        fontWeight: '500',
        lineHeight: '1.4'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '4px',
        opacity: 0.7,
        transition: 'opacity 0.2s',
        flexShrink: 0
    }
};

export default ToastProvider;
