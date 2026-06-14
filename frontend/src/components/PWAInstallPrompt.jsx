import React, { useState, useEffect } from 'react';
import { usePWA } from '../context/PWAContext';

export const PWAInstallPrompt = () => {
    const { isInstallable, isInstalled, installPWA } = usePWA();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show the prompt with a slight delay if installable and not installed
        if (isInstallable && !isInstalled) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isInstallable, isInstalled]);

    const handleDismiss = () => {
        setIsVisible(false);
        // Store in session storage to not show again in this session
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    const handleInstall = async () => {
        await installPWA();
        setIsVisible(false);
    };

    // Don't show if already dismissed in this session
    if (sessionStorage.getItem('pwa_prompt_dismissed') === 'true') {
        return null;
    }

    if (!isVisible) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.iconContainer}>
                        <img src="/logo.png" alt="TriSphere" style={styles.icon} />
                    </div>
                    <button onClick={handleDismiss} style={styles.closeButton}>✕</button>
                </div>
                <div style={styles.content}>
                    <h2 style={styles.title}>Install TriSphere</h2>
                    <p style={styles.description}>
                        Install TriSphere on your home screen for a faster, offline-capable, and premium experience.
                    </p>
                    <div style={styles.features}>
                        <div style={styles.feature}>
                            <span style={styles.featureIcon}>🚀</span>
                            <span style={styles.featureText}>Faster Loading</span>
                        </div>
                        <div style={styles.feature}>
                            <span style={styles.featureIcon}>📡</span>
                            <span style={styles.featureText}>Offline Access</span>
                        </div>
                        <div style={styles.feature}>
                            <span style={styles.featureIcon}>🔔</span>
                            <span style={styles.featureText}>Push Notifications</span>
                        </div>
                    </div>
                </div>
                <div style={styles.footer}>
                    <button onClick={handleDismiss} style={styles.cancelBtn}>Not Now</button>
                    <button onClick={handleInstall} style={styles.installBtn}>Install Now</button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        right: '24px',
        maxWidth: '400px',
        zIndex: 9999,
        animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    card: {
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        color: 'white',
        position: 'relative',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
    },
    iconContainer: {
        width: '64px',
        height: '64px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)',
    },
    icon: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        borderRadius: '8px',
    },
    closeButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'transparent',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.6)',
        cursor: 'pointer',
        fontSize: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        transition: 'color 0.2s ease',
    },
    content: {
        marginBottom: '24px',
    },
    title: {
        fontSize: '22px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    description: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: '1.5',
        margin: '0 0 20px 0',
    },
    features: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
    },
    feature: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '6px 12px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    featureIcon: {
        fontSize: '14px',
    },
    featureText: {
        fontSize: '12px',
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.9)',
    },
    footer: {
        display: 'flex',
        gap: '12px',
    },
    cancelBtn: {
        flex: 1,
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    installBtn: {
        flex: 2,
        padding: '12px',
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        border: 'none',
        borderRadius: '12px',
        color: 'white',
        fontWeight: '700',
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 8px 20px rgba(79, 70, 229, 0.4)',
        transition: 'all 0.2s ease',
    },
};

// Add global animation style if not exists
if (typeof document !== 'undefined' && !document.querySelector('#pwa-prompt-styles')) {
    const style = document.createElement('style');
    style.id = 'pwa-prompt-styles';
    style.textContent = `
        @keyframes slideUp {
            from { transform: translateY(100%) scale(0.9); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @media (min-width: 640px) {
            #pwa-install-prompt {
                left: 24px;
                right: auto;
            }
        }
    `;
    document.head.appendChild(style);
}
