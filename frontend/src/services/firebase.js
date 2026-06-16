import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getMessaging } from 'firebase/messaging';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);



// Create secondary app for admin to create users without affecting their session
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// Set persistence to LOCAL for main auth
const initializePersistence = async () => {
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch (error) {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (fallbackError) {
      console.error('Error setting persistence:', fallbackError);
    }
  }
};

initializePersistence();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

let messagingInstance = null;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn('Firebase Messaging is not supported or failed to initialize in this environment:', e);
}

export const messaging = messagingInstance;

export default app;
