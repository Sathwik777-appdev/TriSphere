/**
 * Safe LocalStorage wrapper with error handling
 * Handles quota exceeded, privacy mode, and parsing errors
 */

class SafeStorage {
  constructor(storage = localStorage) {
    this.storage = storage;
    this.isAvailable = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const test = '__storage_test__';
      this.storage.setItem(test, test);
      this.storage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('Storage not available:', e);
      return false;
    }
  }

  get(key, defaultValue = null) {
    if (!this.isAvailable) return defaultValue;
    
    try {
      const item = this.storage.getItem(key);
      if (item === null) return defaultValue;
      
      // Try to parse as JSON, if fails return as string
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    } catch (error) {
      console.warn(`Failed to get item "${key}" from storage:`, error);
      return defaultValue;
    }
  }

  set(key, value) {
    if (!this.isAvailable) {
      console.warn('Storage not available, cannot save:', key);
      return false;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      this.storage.setItem(key, serialized);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Clearing old data...');
        this.clearOldData();
        // Try again after clearing
        try {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          this.storage.setItem(key, serialized);
          return true;
        } catch (retryError) {
          console.error('Still failed after clearing:', retryError);
          return false;
        }
      }
      console.error(`Failed to set item "${key}":`, error);
      return false;
    }
  }

  remove(key) {
    if (!this.isAvailable) return false;
    
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item "${key}":`, error);
      return false;
    }
  }

  clear() {
    if (!this.isAvailable) return false;
    
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  keys() {
    if (!this.isAvailable) return [];
    
    try {
      return Object.keys(this.storage);
    } catch (error) {
      console.warn('Failed to get storage keys:', error);
      return [];
    }
  }

  // Clear old data based on timestamp or size
  clearOldData() {
    const keys = this.keys();
    const itemsWithAge = [];

    keys.forEach(key => {
      try {
        const value = this.get(key);
        if (value && typeof value === 'object' && value.timestamp) {
          itemsWithAge.push({
            key,
            timestamp: value.timestamp,
            size: JSON.stringify(value).length
          });
        }
      } catch (e) {
        // Skip invalid items
      }
    });

    // Sort by age (oldest first)
    itemsWithAge.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 20% of items
    const toRemove = Math.ceil(itemsWithAge.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.remove(itemsWithAge[i].key);
    }
  }

  // Get storage size estimate
  getSize() {
    if (!this.isAvailable) return 0;
    
    let size = 0;
    try {
      for (const key in this.storage) {
        if (this.storage.hasOwnProperty(key)) {
          size += this.storage[key].length + key.length;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate storage size:', error);
    }
    return size;
  }

  // Get human-readable size
  getSizeFormatted() {
    const bytes = this.getSize();
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

// Export singleton instance
export const safeLocalStorage = new SafeStorage(localStorage);
export const safeSessionStorage = new SafeStorage(sessionStorage);

// Export class for custom instances
export default SafeStorage;
