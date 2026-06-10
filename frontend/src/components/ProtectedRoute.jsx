import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogoLoader } from './AnimatedLogo';

/**
 * Protected route component that checks authentication and role
 * @param {string} requiredRole - Required user role ('teacher', 'student', 'parent')
 * @param {React.Component} Component - Component to render if authorized
 */
export const ProtectedRoute = ({ requiredRole, Component }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <LogoLoader size={80} label="Verifying access..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    // Special case: allow 'principal' role to access 'admin' routes
    const hasAccess = role === requiredRole ||
      (requiredRole === 'admin' && role === 'principal');

    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Component />;
};

const styles = {
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5'
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  }
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
