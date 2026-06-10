/**
 * Session Timeout Component
 * Shows warning modal before auto-logout
 */
import React from 'react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { useAuth } from '../hooks/useAuth';

export const SessionTimeoutWarning = () => {
    const { user } = useAuth();
    const { showWarning, minutesLeft, resetTimer } = useSessionTimeout();

    if (!user || !showWarning) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.icon}>⏰</div>
                <h3 style={styles.title}>Session Expiring Soon</h3>
                <p style={styles.message}>
                    Your session will expire in <strong>{minutesLeft}</strong> minute{minutesLeft !== 1 ? 's' : ''} due to inactivity.
                </p>
                <p style={styles.subtext}>
                    Move your mouse or click anywhere to stay logged in.
                </p>
                <button onClick={resetTimer} style={styles.button}>
                    ✓ I'm Still Here
                </button>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'popIn 0.3s ease'
    },
    icon: {
        fontSize: '48px',
        marginBottom: '16px'
    },
    title: {
        margin: '0 0 12px 0',
        fontSize: '20px',
        fontWeight: '700',
        color: '#1f2937'
    },
    message: {
        margin: '0 0 8px 0',
        fontSize: '16px',
        color: '#4b5563',
        lineHeight: '1.5'
    },
    subtext: {
        margin: '0 0 24px 0',
        fontSize: '14px',
        color: '#6b7280'
    },
    button: {
        padding: '12px 32px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
    }
};

export default SessionTimeoutWarning;
