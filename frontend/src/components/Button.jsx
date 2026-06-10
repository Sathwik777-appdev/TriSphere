/**
 * Button Component with loading state
 * Prevents double-clicks and shows loading indicator
 */
import React from 'react';

export const Button = ({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  type = 'button',
  fullWidth = false,
  size = 'medium',
  ...props
}) => {
  const variants = {
    primary: {
      backgroundColor: loading || disabled ? '#9ca3af' : '#3b82f6',
      color: '#fff',
      border: 'none'
    },
    secondary: {
      backgroundColor: loading || disabled ? '#e5e7eb' : '#fff',
      color: loading || disabled ? '#9ca3af' : '#374151',
      border: '1px solid #d1d5db'
    },
    success: {
      backgroundColor: loading || disabled ? '#9ca3af' : '#10b981',
      color: '#fff',
      border: 'none'
    },
    danger: {
      backgroundColor: loading || disabled ? '#9ca3af' : '#ef4444',
      color: '#fff',
      border: 'none'
    },
    warning: {
      backgroundColor: loading || disabled ? '#9ca3af' : '#f59e0b',
      color: '#fff',
      border: 'none'
    }
  };

  const sizes = {
    small: { padding: '6px 12px', fontSize: '13px' },
    medium: { padding: '10px 20px', fontSize: '14px' },
    large: { padding: '14px 28px', fontSize: '16px' }
  };

  const handleClick = (e) => {
    if (loading || disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={loading || disabled}
      style={{
        ...styles.base,
        ...variants[variant],
        ...sizes[size],
        width: fullWidth ? '100%' : 'auto',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.6 : 1
      }}
      {...props}
    >
      {loading && (
        <span style={styles.spinner}></span>
      )}
      <span style={{ opacity: loading ? 0.7 : 1 }}>
        {children}
      </span>
    </button>
  );
};

const styles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '6px',
    fontWeight: '500',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    outline: 'none',
    position: 'relative'
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }
};

// Add animation
if (typeof document !== 'undefined' && !document.querySelector('#button-spinner-animation')) {
  const style = document.createElement('style');
  style.id = 'button-spinner-animation';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default Button;
