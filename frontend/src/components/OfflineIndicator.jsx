/**
 * Offline Indicator Component
 * Shows connectivity status and sync queue
 */

import React from 'react';
import { useOffline } from '../hooks/useOffline';
import { offlineDB } from '../utils/offlineDB';

export const OfflineIndicator = () => {
  const { offline, syncing, queueLength, syncQueuedOperations } = useOffline();

  if (!offline && queueLength === 0) {
    return null; // Don't show anything when online and nothing to sync
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: offline ? '#ef4444' : '#10b981',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: '500',
        maxWidth: '300px'
      }}
    >
      {offline ? (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div>📵 Offline Mode</div>
            {queueLength > 0 && (
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {queueLength} item{queueLength > 1 ? 's' : ''} queued
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {syncing ? (
            <>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div>
                <div>Syncing...</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {queueLength} remaining
                </div>
              </div>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
              </svg>
              <div>
                <div>📶 Online</div>
                {queueLength > 0 && (
                  <button
                    onClick={syncQueuedOperations}
                    style={{
                      fontSize: '12px',
                      opacity: 0.9,
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                      color: 'white'
                    }}
                  >
                    Sync {queueLength} item{queueLength > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// Offline storage info component
export const OfflineStorageInfo = () => {
  const [storageInfo, setStorageInfo] = React.useState(null);

  React.useEffect(() => {
    const loadStorageInfo = async () => {
      const info = await offlineDB.getStorageInfo();
      setStorageInfo(info);
    };
    loadStorageInfo();
  }, []);

  if (!storageInfo) return null;

  return (
    <div style={{ 
      padding: '12px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '13px'
    }}>
      <div style={{ fontWeight: '600', marginBottom: '8px' }}>
        💾 Offline Storage
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Used:</span>
        <span style={{ fontWeight: '500' }}>{storageInfo.usageMB} MB</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>Available:</span>
        <span style={{ fontWeight: '500' }}>{storageInfo.quotaMB} MB</span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '8px'
      }}>
        <div style={{
          width: `${storageInfo.percentUsed}%`,
          height: '100%',
          backgroundColor: storageInfo.percentUsed > 80 ? '#ef4444' : '#10b981',
          transition: 'width 0.3s'
        }}/>
      </div>
      <div style={{ textAlign: 'center', marginTop: '4px', color: '#6b7280' }}>
        {storageInfo.percentUsed}% used
      </div>
    </div>
  );
};

export default OfflineIndicator;
