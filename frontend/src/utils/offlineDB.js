import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

/**
 * IndexedDB Utility for Offline Storage
 * Stores lesson plans, textbooks, notes, and sync queue
 */

const DB_NAME = 'TriSphereOffline';
const DB_VERSION = 3; // Bumped to 3 for simulation stores

class OfflineDB {
  constructor() {
    this.db = null;
  }

  // Open database connection
  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('lessonPlans')) {
          const lessonStore = db.createObjectStore('lessonPlans', { keyPath: 'id' });
          lessonStore.createIndex('teacherId', 'teacherId', { unique: false });
          lessonStore.createIndex('class', 'class', { unique: false });
          lessonStore.createIndex('subject', 'subject', { unique: false });
        }

        if (!db.objectStoreNames.contains('textbooks')) {
          const textbookStore = db.createObjectStore('textbooks', { keyPath: 'id' });
          textbookStore.createIndex('class', 'class', { unique: false });
          textbookStore.createIndex('subject', 'subject', { unique: false });
        }

        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('userId', 'userId', { unique: false });
          notesStore.createIndex('subject', 'subject', { unique: false });
        }

        if (!db.objectStoreNames.contains('assignments')) {
          const assignmentStore = db.createObjectStore('assignments', { keyPath: 'id' });
          assignmentStore.createIndex('class', 'class', { unique: false });
          assignmentStore.createIndex('subject', 'subject', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }

        // NEW: Quizzes store for offline quiz access
        if (!db.objectStoreNames.contains('quizzes')) {
          const quizStore = db.createObjectStore('quizzes', { keyPath: 'id' });
          quizStore.createIndex('class', 'class', { unique: false });
          quizStore.createIndex('subject', 'subject', { unique: false });
          quizStore.createIndex('chapterName', 'chapterName', { unique: false });
        }

        // NEW: Announcements store for offline announcement viewing
        if (!db.objectStoreNames.contains('announcements')) {
          const announcementStore = db.createObjectStore('announcements', { keyPath: 'id' });
          announcementStore.createIndex('class', 'class', { unique: false });
          announcementStore.createIndex('targetAudience', 'targetAudience', { unique: false });
        }

        // NEW: Simulation stores for offline lab work
        if (!db.objectStoreNames.contains('simulationAssignments')) {
          const simStore = db.createObjectStore('simulationAssignments', { keyPath: 'id' });
          simStore.createIndex('class', 'class', { unique: false });
          simStore.createIndex('subject', 'subject', { unique: false });
        }

        if (!db.objectStoreNames.contains('simulationSubmissions')) {
          db.createObjectStore('simulationSubmissions', { keyPath: 'id' });
        }

        console.log('IndexedDB schema created/updated to version', DB_VERSION);
      };
    });
  }

  // Generic CRUD operations
  async add(storeName, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Query by index
  async getByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Lesson Plans
  async saveLessonPlan(lessonPlan) {
    return this.put('lessonPlans', {
      ...lessonPlan,
      savedAt: Date.now(),
      offline: true
    });
  }

  async getLessonPlans(teacherId) {
    if (teacherId) {
      return this.getByIndex('lessonPlans', 'teacherId', teacherId);
    }
    return this.getAll('lessonPlans');
  }

  async getLessonPlansByClass(classNumber, subject) {
    const allPlans = await this.getAll('lessonPlans');
    return allPlans.filter(plan =>
      plan.class === classNumber &&
      (!subject || plan.subject === subject)
    );
  }

  // Textbooks
  async saveTextbook(textbook) {
    return this.put('textbooks', {
      ...textbook,
      savedAt: Date.now(),
      offline: true
    });
  }

  async getTextbooks(classNumber, subject) {
    const allTextbooks = await this.getAll('textbooks');
    return allTextbooks.filter(book =>
      book.class === classNumber && book.subject === subject
    );
  }

  // Notes
  async saveNote(note) {
    return this.put('notes', {
      ...note,
      savedAt: Date.now(),
      offline: true
    });
  }

  async getNotes(userId, subject) {
    const allNotes = await this.getAll('notes');
    return allNotes.filter(note =>
      note.userId === userId &&
      (!subject || note.subject === subject)
    );
  }

  // Assignments
  async saveAssignment(assignment) {
    return this.put('assignments', {
      ...assignment,
      savedAt: Date.now(),
      offline: true
    });
  }

  async getAssignments(classNumber, subject) {
    const allAssignments = await this.getAll('assignments');
    return allAssignments.filter(assignment =>
      assignment.class === classNumber &&
      (!subject || assignment.subject === subject)
    );
  }

  // Sync Queue - for operations to sync when online
  async addToSyncQueue(operation) {
    return this.add('syncQueue', {
      ...operation,
      timestamp: Date.now(),
      synced: false
    });
  }

  async getSyncQueue() {
    const queue = await this.getAll('syncQueue');
    return queue.filter(item => !item.synced);
  }

  async markAsSynced(id) {
    const item = await this.get('syncQueue', id);
    if (item) {
      item.synced = true;
      item.syncedAt = Date.now();
      return this.put('syncQueue', item);
    }
  }

  async clearSyncQueue() {
    return this.clear('syncQueue');
  }

  // Get storage usage
  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
          quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
          percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      }
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
    return null;
  }

  // ============ QUIZZES (NEW) ============
  async saveQuiz(quiz) {
    return this.put('quizzes', {
      ...quiz,
      savedAt: Date.now(),
      offline: true
    });
  }

  async saveQuizzes(quizzes) {
    for (const quiz of quizzes) {
      await this.saveQuiz(quiz);
    }
  }

  async getQuizzes(classNumber, subject) {
    const allQuizzes = await this.getAll('quizzes');
    return allQuizzes.filter(quiz =>
      (quiz.class === classNumber || quiz.class === String(classNumber)) &&
      (!subject || quiz.subject === subject)
    );
  }

  async getQuiz(quizId) {
    return this.get('quizzes', quizId);
  }

  // ============ ANNOUNCEMENTS (NEW) ============
  async saveAnnouncement(announcement) {
    return this.put('announcements', {
      ...announcement,
      savedAt: Date.now(),
      offline: true
    });
  }

  async saveAnnouncements(announcements) {
    for (const announcement of announcements) {
      await this.saveAnnouncement(announcement);
    }
  }

  async getAnnouncements(classNumber = null, targetAudience = null) {
    const allAnnouncements = await this.getAll('announcements');
    return allAnnouncements.filter(announcement => {
      // Filter by class if provided
      if (classNumber && announcement.class && announcement.class !== classNumber) {
        return false;
      }
      // Filter by target audience if provided
      if (targetAudience && announcement.targetAudience &&
        announcement.targetAudience !== targetAudience &&
        announcement.targetAudience !== 'all') {
        return false;
      }
      return true;
    });
  }

  // ============ SIMULATIONS (NEW) ============
  async saveSimulationAssignment(assignment) {
    return this.put('simulationAssignments', {
      ...assignment,
      savedAt: Date.now(),
      offline: true
    });
  }

  async saveSimulationAssignments(assignments) {
    for (const assignment of assignments) {
      await this.saveSimulationAssignment(assignment);
    }
  }

  async getSimulationAssignments(classNumber, subject) {
    const allAssignments = await this.getAll('simulationAssignments');
    return allAssignments.filter(assignment =>
      (assignment.class === classNumber || assignment.class === String(classNumber)) &&
      (!subject || assignment.subject === subject)
    );
  }

  async queueOfflineSubmission(submission) {
    await this.put('simulationSubmissions', {
      ...submission,
      savedAt: Date.now(),
      synced: false
    });
    return this.addToSyncQueue({
      type: 'simulation_submission',
      submissionId: submission.id,
      data: submission
    });
  }

  async getQueuedSubmissions() {
    const allSubmissions = await this.getAll('simulationSubmissions');
    return allSubmissions.filter(s => !s.synced);
  }

  async markSubmissionSynced(id) {
    const item = await this.get('simulationSubmissions', id);
    if (item) {
      item.synced = true;
      item.syncedAt = Date.now();
      return this.put('simulationSubmissions', item);
    }
  }
}

// Export singleton instance
export const offlineDB = new OfflineDB();

// Helper to check if browser supports offline features
export const supportsOffline = () => {
  return 'indexedDB' in window && 'serviceWorker' in navigator;
};

// Check if currently offline
export const isOffline = () => {
  return !navigator.onLine;
};

// Add online/offline event listeners
export const addConnectivityListeners = (onOnline, onOffline) => {
  if (Capacitor.isNativePlatform()) {
    const handlePromise = Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        onOnline();
      } else {
        onOffline();
      }
    });

    return () => {
      handlePromise.then(h => h.remove());
    };
  } else {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }
};
