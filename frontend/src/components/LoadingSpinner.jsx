/**
 * Loading Spinner Component with Skeleton Support
 * Now supports both spinner and skeleton loading modes
 */
import React from 'react';
import { SkeletonBox, SkeletonContentCard, SkeletonDashboard } from './Skeleton';

export const LoadingSpinner = ({
  size = 40,
  color = '#3b82f6',
  message = '',
  variant = 'spinner', // 'spinner' | 'skeleton' | 'cards' | 'dashboard'
  cardCount = 3
}) => {
  // Skeleton variants
  if (variant === 'skeleton') {
    return (
      <div style={styles.container}>
        <SkeletonBox width="200px" height="24px" style={{ marginBottom: '16px' }} />
        <SkeletonBox width="100%" height="120px" style={{ marginBottom: '12px' }} />
        <SkeletonBox width="80%" height="16px" />
        {message && <p style={styles.message}>{message}</p>}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div style={{ ...styles.container, width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', width: '100%' }}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <SkeletonContentCard key={i} />
          ))}
        </div>
        {message && <p style={styles.message}>{message}</p>}
      </div>
    );
  }

  if (variant === 'dashboard') {
    return <SkeletonDashboard cardCount={cardCount} />;
  }

  // Default spinner
  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.spinner,
          width: size,
          height: size,
          borderColor: `${color}20`,
          borderTopColor: color
        }}
      />
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  spinner: {
    border: '4px solid',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  message: {
    marginTop: '12px',
    color: '#6b7280',
    fontSize: '14px'
  }
};

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  if (!document.querySelector('#spinner-animation')) {
    style.id = 'spinner-animation';
    document.head.appendChild(style);
  }
}

export default LoadingSpinner;
