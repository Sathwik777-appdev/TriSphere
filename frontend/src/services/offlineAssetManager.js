import { Filesystem, Directory } from '@capacitor/filesystem';
import { safeLocalStorage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';

// Internal key for storing our dictionary of downloaded files
// Format: { [documentId]: localUri }
const OFFLINE_INDEX_KEY = 'tri_offline_assets_index';

class OfflineAssetManager {
  constructor() {
    this.index = safeLocalStorage.get(OFFLINE_INDEX_KEY) || {};
  }

  // Save updated index to localStorage
  _saveIndex() {
    safeLocalStorage.set(OFFLINE_INDEX_KEY, this.index);
  }

  /**
   * Convert a Blob to Base64 (needed for Capacitor Filesystem)
   */
  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result.split(',')[1]); // return just the b64 data string
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Checks if a document (e.g., textbook ID) is available offline
   */
  isDownloaded(documentId) {
    return !!this.index[documentId];
  }

  /**
   * Gets the local URI for a downloaded document. 
   * Returns Capacitor's web-safe URI (Capacitor.convertFileSrc) so it can be loaded directly in <iframe> or <img>
   */
  async getLocalUrl(documentId) {
    if (!this.isDownloaded(documentId)) return null;
    
    const localPath = this.index[documentId];
    try {
      const result = await Filesystem.getUri({
        directory: Directory.Data,
        path: localPath
      });
      return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
      console.warn("Local file missing or deleted, cleaning index...", e);
      delete this.index[documentId];
      this._saveIndex();
      return null;
    }
  }

  /**
   * Downloads an asset over HTTP and saves it to the native device storage.
   * Only works on Native Android/iOS. Falls back to normal browser cache on Web.
   * 
   * @param {string} remoteUrl The URL to fetch (e.g. Firebase Storage, Github)
   * @param {string} documentId Unique ID of the textbook/asset
   * @param {string} extension File extension (default: '.pdf')
   */
  async downloadAsset(remoteUrl, documentId, extension = '.pdf') {
    if (!Capacitor.isNativePlatform()) {
      console.log('Skipping native download, not on Android/iOS');
      return false;
    }

    try {
      const fileName = `offline_asset_${documentId}${extension}`;
      
      console.log(`Downloading ${remoteUrl} to ${fileName}...`);
      
      // Fetch binary blob
      const response = await fetch(remoteUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      
      // Convert to Base64
      const base64Data = await this._blobToBase64(blob);

      // Save using Capacitor Filesystem
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data,
      });

      console.log('Saved offline file at:', savedFile.uri);

      // Register in our Index
      this.index[documentId] = fileName;
      this._saveIndex();

      return true;
    } catch (err) {
      console.error('Failed to download offline asset:', err);
      throw err;
    }
  }

  /**
   * Deletes a downloaded asset to free up storage space
   */
  async deleteAsset(documentId) {
    if (!this.isDownloaded(documentId)) return;

    try {
      const fileName = this.index[documentId];
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn("File was already deleted or missing", e);
    }

    delete this.index[documentId];
    this._saveIndex();
  }

  /**
   * Gets the total storage used by all offline assets (in MB)
   */
  async getStorageUsageMB() {
    let totalBytes = 0;
    
    for (const [docId, fileName] of Object.entries(this.index)) {
      try {
        const stat = await Filesystem.stat({
          path: fileName,
          directory: Directory.Data
        });
        totalBytes += stat.size;
      } catch (e) {
        // File missing, purge from index
        delete this.index[docId];
        this._saveIndex();
      }
    }

    return (totalBytes / (1024 * 1024)).toFixed(2);
  }

  /**
   * Clears ALL downloaded assets
   */
  async clearAll() {
    const ids = Object.keys(this.index);
    for (const id of ids) {
      await this.deleteAsset(id);
    }
    this.index = {};
    this._saveIndex();
  }
}

export const offlineAssetManager = new OfflineAssetManager();
