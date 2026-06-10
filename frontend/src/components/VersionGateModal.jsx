import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * VersionGateModal - Premium Glassmorphic Update Screen
 * 
 * Supports two modes:
 *  1. Force Update (isForceUpdate = true): Screen is locked; user MUST update to proceed.
 *  2. Soft Update (isForceUpdate = false): Dismissible; shows a "Later" option.
 */
export default function VersionGateModal({
  isOpen,
  isForceUpdate = false,
  latestVersion = '1.0.0',
  androidStoreUrl = '',
  iosStoreUrl = '',
  onClose,
}) {
  const handleUpdate = () => {
    // Detect OS to choose target URL
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    let targetUrl = androidStoreUrl;

    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      targetUrl = iosStoreUrl;
    }

    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback
      window.open('https://play.google.com/store', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.backdrop}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            style={styles.modalCard}
          >
            {/* Header / Icon */}
            <div style={styles.iconContainer}>
              <span style={styles.icon} role="img" aria-label="Rocket or Warning">
                {isForceUpdate ? '🚨' : '🚀'}
              </span>
            </div>

            {/* Title */}
            <h2 style={styles.title}>
              {isForceUpdate ? 'Update Required' : 'Update Available'}
            </h2>

            {/* Version Badge */}
            <div style={styles.badge}>
              New Version: v{latestVersion}
            </div>

            {/* Description */}
            <p style={styles.description}>
              {isForceUpdate
                ? "This version of TriSphere is no longer supported. Please update to the latest version to continue using the platform."
                : "A new version of TriSphere is available with new learning tools and stability fixes. Would you like to update now?"}
            </p>

            {/* CTA Buttons */}
            <div style={styles.buttonGroup}>
              <button onClick={handleUpdate} style={styles.primaryButton}>
                Update Now
              </button>

              {!isForceUpdate && (
                <button onClick={onClose} style={styles.secondaryButton}>
                  Maybe Later
                </button>
              )}
            </div>

            {/* Footer Brand */}
            <div style={styles.footer}>
              TriSphere Learning Hub
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999999, // Ensure it's above all overlays
    background: 'rgba(5, 8, 22, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
  },
  modalCard: {
    width: '100%',
    maxWidth: '400px',
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 95, 0.95))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '24px',
    padding: '36px 30px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15)',
    textAlign: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  iconContainer: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  icon: {
    fontSize: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffffff',
    margin: '0 0 10px 0',
    letterSpacing: '-0.5px',
    textShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
  },
  badge: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#67e8f9',
    background: 'rgba(103, 232, 249, 0.1)',
    border: '1px solid rgba(103, 232, 249, 0.3)',
    padding: '4px 12px',
    borderRadius: '999px',
    marginBottom: '18px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  description: {
    fontSize: '14.5px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.75)',
    margin: '0 0 28px 0',
  },
  buttonGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryButton: {
    width: '100%',
    height: '48px',
    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #4f46e5 100%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    width: '100%',
    height: '46px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14.5px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
  },
  footer: {
    marginTop: '32px',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
};
