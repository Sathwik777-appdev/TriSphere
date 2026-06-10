import React from 'react';
import { logoutUser } from '../services/authService';
import { useNavigate } from 'react-router-dom';

export default function DesktopLockedMessage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a, #1e3a8a, #0f172a)',
      color: '#ffffff',
      padding: '20px',
      textAlign: 'center',
      fontFamily: '"Product Sans", sans-serif'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '500px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.2)',
            padding: '10px',
            borderRadius: '50%',
            fontSize: '48px'
          }}>
            📱
          </div>
        </div>
        
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>
          Mobile App Only
        </h1>
        
        <p style={{ fontSize: '18px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
          This dashboard is currently optimized exclusively for our mobile application. The desktop interface is undergoing maintenance and will be back soon!
        </p>
        
        <p style={{ fontSize: '16px', color: '#cbd5e1', marginBottom: '32px' }}>
          Please log in using your mobile device or the TriSphere Android app to continue.
        </p>
        
        <button 
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
