import React from 'react';

/**
 * Reusable Confirmation Modal Component
 * Replaces window.confirm() with a styled modal that matches the app's glassmorphism design
 */
export const ConfirmationModal = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmStyle = 'danger' // 'danger', 'primary', 'success'
}) => {
    if (!isOpen) return null;

    const getConfirmButtonStyle = () => {
        switch (confirmStyle) {
            case 'danger':
                return {
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                };
            case 'success':
                return {
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                };
            case 'primary':
            default:
                return {
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                };
        }
    };

    return (
        <div style={styles.overlay} onClick={onCancel}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.iconContainer}>
                    {confirmStyle === 'danger' ? (
                        <span style={styles.iconDanger}>⚠️</span>
                    ) : confirmStyle === 'success' ? (
                        <span style={styles.iconSuccess}>✅</span>
                    ) : (
                        <span style={styles.iconPrimary}>❓</span>
                    )}
                </div>

                <h3 style={styles.title}>{title}</h3>
                <p style={styles.message}>{message}</p>

                <div style={styles.buttonContainer}>
                    <button
                        onClick={onCancel}
                        style={styles.cancelButton}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{ ...styles.confirmButton, ...getConfirmButtonStyle() }}
                    >
                        {confirmText}
                    </button>
                </div>
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
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out'
    },
    modal: {
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 95, 0.95))',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)',
        animation: 'slideUp 0.3s ease-out'
    },
    iconContainer: {
        marginBottom: '16px'
    },
    iconDanger: {
        fontSize: '48px',
        display: 'block'
    },
    iconSuccess: {
        fontSize: '48px',
        display: 'block'
    },
    iconPrimary: {
        fontSize: '48px',
        display: 'block'
    },
    title: {
        margin: '0 0 12px 0',
        fontSize: '20px',
        fontWeight: '700',
        color: '#ffffff'
    },
    message: {
        margin: '0 0 24px 0',
        fontSize: '15px',
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: '1.5'
    },
    buttonContainer: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
    },
    cancelButton: {
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#ffffff',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    confirmButton: {
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    }
};

export default ConfirmationModal;
