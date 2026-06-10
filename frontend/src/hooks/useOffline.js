/**
 * Offline Manager Hook
 * Manages offline state, sync queue, and connectivity
 */

import { useState, useEffect } from 'react';
import { offlineDB, isOffline, addConnectivityListeners } from '../utils/offlineDB';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export const useOffline = () => {
  const [offline, setOffline] = useState(isOffline());
  const [syncQueue, setSyncQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Load sync queue on mount
    loadSyncQueue();

    // Check initial network status asynchronously on native platforms
    const checkInitialStatus = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await Network.getStatus();
          setOffline(!status.connected);
        } catch (error) {
          console.warn('Failed to check initial Capacitor network status:', error);
        }
      }
    };
    checkInitialStatus();

    // Set up connectivity listeners
    const cleanup = addConnectivityListeners(
      () => {
        console.log('📶 Back online!');
        setOffline(false);
        syncQueuedOperations();
      },
      () => {
        console.log('📵 Gone offline');
        setOffline(true);
      }
    );

    return cleanup;
  }, []);

  const loadSyncQueue = async () => {
    try {
      const queue = await offlineDB.getSyncQueue();
      setSyncQueue(queue);
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  };

  const addToQueue = async (operation) => {
    try {
      await offlineDB.addToSyncQueue(operation);
      await loadSyncQueue();
      return true;
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
      return false;
    }
  };

  const syncQueuedOperations = async () => {
    if (syncing || offline) return;

    setSyncing(true);
    try {
      const queue = await offlineDB.getSyncQueue();
      console.log(`Syncing ${queue.length} queued operations...`);

      for (const item of queue) {
        try {
          await syncOperation(item);
          await offlineDB.markAsSynced(item.id);
        } catch (error) {
          console.error('Failed to sync operation:', item, error);
        }
      }

      await loadSyncQueue();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const syncOperation = async (operation) => {
    // Implement sync logic based on operation type
    const { type, data, url, method, headers } = operation;

    if (url) {
      // Generic HTTP request
      const response = await fetch(url, {
        method: method || 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      return response.json();
    }

    // Handle specific types
    switch (type) {
      case 'lesson-plan':
        // Will be handled by Firebase sync
        console.log('Lesson plan queued for Firebase sync');
        break;
      case 'assignment':
        console.log('Assignment queued for Firebase sync');
        break;
      default:
        console.warn('Unknown operation type:', type);
    }
  };

  return {
    offline,
    syncQueue,
    syncing,
    addToQueue,
    syncQueuedOperations,
    queueLength: syncQueue.length
  };
};

// Hook for caching data for offline use
export const useOfflineCache = (storeName) => {
  const [cached, setCached] = useState([]);
  const [loading, setLoading] = useState(false);

  const cacheData = async (data) => {
    try {
      setLoading(true);
      if (Array.isArray(data)) {
        for (const item of data) {
          await offlineDB.put(storeName, item);
        }
      } else {
        await offlineDB.put(storeName, data);
      }
      await loadCached();
    } catch (error) {
      console.error('Failed to cache data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCached = async () => {
    try {
      setLoading(true);
      const data = await offlineDB.getAll(storeName);
      setCached(data);
    } catch (error) {
      console.error('Failed to load cached data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      await offlineDB.clear(storeName);
      setCached([]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  useEffect(() => {
    loadCached();
  }, [storeName]);

  return {
    cached,
    loading,
    cacheData,
    loadCached,
    clearCache
  };
};
