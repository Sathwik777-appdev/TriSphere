import { getToken, onMessage } from 'firebase/messaging';
import { doc, arrayUnion, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { messaging, db } from './firebase';

// VAPID key is ideally stored in environment variables. 
// For TriSphere, you must replace this with your actual Web Push certificate from Firebase Console.
const VAPID_KEY = import.meta.env.VITE_VAPID_KEY || "YOUR_VAPID_KEY_HERE";

export const requestNotificationPermission = async (userId) => {
  try {
    console.log('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      try {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          console.log('FCM Token retrieved:', currentToken.substring(0, 20) + '...');
          await saveTokenToDatabase(currentToken, userId);
          return true;
        } else {
          console.log('No registration token available. Request permission to generate one.');
          return false;
        }
      } catch (tokenError) {
        console.error('An error occurred while retrieving token:', tokenError);
        return false;
      }
    } else {
      console.log('Unable to get permission to notify.');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

const saveTokenToDatabase = async (token, userId) => {
  if (!userId) return;
  const userRef = doc(db, 'users', userId);
  try {
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    } else {
      // Create user if not exists (edge case)
      await setDoc(userRef, { fcmTokens: [token] }, { merge: true });
    }
    console.log('Token saved to Firestore');
  } catch (error) {
    console.error('Error saving token to Firestore:', error);
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
