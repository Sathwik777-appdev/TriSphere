import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { safeLocalStorage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';


/**
 * Check if user email exists in Firestore users collection
 */
export const checkUserExists = async (email) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking user:', error);
    throw error;
  }
};

/**
 * Get user role from Firestore
 */
export const getUserRole = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data().role;
    }
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    throw error;
  }
};

/**
 * Get full user data from Firestore
 */
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

/**
 * Setup Recaptcha
 */
export const setupRecaptcha = (elementId) => {
  // Use the permanent container for stability
  const STABLE_ID = 'recaptcha-verifier-container';

  // If we already have a valid verifier initialized, REUSE IT.
  // DO NOT clear it. This prevents the "already been rendered" error.
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  // Check if permanent element exists in DOM
  const element = document.getElementById(STABLE_ID);
  if (!element) {
    console.error(`❌ setupRecaptcha: Permanent container "${STABLE_ID}" not found in index.html.`);
    return null;
  }

  // Clear innerHTML just in case there is some lingering content, but do not replace the node
  // replacing the node breaks Firebase's internal element tracking.
  try {
    element.innerHTML = '';
  } catch (e) {
    console.warn('setupRecaptcha: Failed to clear element innerHTML:', e);
  }

  try {
    // Initialize exactly once
    window.recaptchaVerifier = new RecaptchaVerifier(auth, STABLE_ID, {
      'size': 'invisible',
      'callback': (response) => {
        // reCAPTCHA solved
      }
    });

    return window.recaptchaVerifier;
  } catch (error) {
    console.error('🔥 setupRecaptcha: Failed to initialize RecaptchaVerifier:', error);
    return null;
  }
};

/**
 * Send OTP to phone number
 */
export const sendOtp = async (phoneNumber, recaptchaVerifier) => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Use Native Firebase Auth (bypasses reCAPTCHA)
      return new Promise((resolve, reject) => {
        let sentListener = null;
        let failedListener = null;

        const cleanup = () => {
          if (sentListener) sentListener.remove();
          if (failedListener) failedListener.remove();
        };

        const executeNativeAuth = async () => {
          try {
            sentListener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
              cleanup();
              resolve({ verificationId: event.verificationId, isNative: true });
            });

            failedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
              cleanup();
              reject(new Error(event.message || 'Phone verification failed'));
            });

            await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
          } catch (err) {
            cleanup();
            reject(err);
          }
        };

        executeNativeAuth();
      });
    } else {
      // Use Web SDK
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return { confirmationResult, isNative: false };
    }
  } catch (error) {
    console.error('🔥 authService: Error sending OTP:', error);
    console.dir(error);
    throw error;
  }
};

/**
 * Verify OTP and LINK it to existing user
 */
export const verifyOtpAndLink = async (user, verificationData, otp) => {
  try {
    let credential;
    if (verificationData.isNative) {
      credential = PhoneAuthProvider.credential(verificationData.verificationId, otp);
    } else {
      credential = PhoneAuthProvider.credential(verificationData.confirmationResult.verificationId, otp);
    }
    await linkWithCredential(user, credential);
    return true;
  } catch (error) {
    // Only log as error if it's not a expected collision (shared number)
    if (error.code !== 'auth/credential-already-in-use' && error.code !== 'auth/account-exists-with-different-credential') {
      console.error('🔥 authService: Error linking phone:', error);
    }
    throw error;
  }
};

/**
 * Register new user with Firestore metadata AND Phone verification
 */
export const registerUser = async (email, password, username, role, classNumber, phoneCredential) => {
  const sanitizedEmail = email?.trim();
  const sanitizedPassword = password?.trim();
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
    const user = userCredential.user;
    const uid = user.uid;

    // Link Phone Credential if provided
    if (phoneCredential) {
      try {
        await linkWithCredential(user, phoneCredential);
      } catch (linkError) {
        console.error('Error linking phone credential:', linkError);
        // Optional: Decide if we should delete the user if linking fails
        // await user.delete();
        // throw new Error('Failed to link phone number. Please try again.');
        // For now, we proceed but log the error (user will have email but no phone linked in Auth)
      }
    }

    // Store user metadata in Firestore
    await setDoc(doc(db, 'users', uid), {
      email,
      username,
      role,
      class: classNumber ? Number(classNumber) : null,
      phoneNumber: phoneCredential ? phoneCredential.providerId : null, // providerId isn't the number, but we can't easily get the number from credential alone without User object.
      // Better to check user.phoneNumber which should be updated after link
      createdAt: serverTimestamp(),
      uid
    });

    return user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

/**
 * Login user - verify Firestore exists and check domain
 */
export const loginUser = async (email, password) => {
  const sanitizedEmail = email?.trim();
  const sanitizedPassword = password?.trim();
  try {
    // Firebase authentication
    const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);

    // Then verify user document exists in Firestore
    const userData = await getUserData(userCredential.user.uid);
    if (!userData) {
      throw new Error('User profile not found in database. Please contact admin.');
    }

    // Check if account is suspended
    if (userData.suspended === true) {
      // Sign out immediately if suspended
      await signOut(auth);
      throw new Error('Your account has been suspended. Please contact the administrator.');
    }

    // Attach role to user object for easy access
    userCredential.user.role = userData.role;

    return userCredential.user;
  } catch (error) {
    // Handle Firebase-specific errors
    if (error.code === 'auth/user-not-found') {
      throw new Error('Email not registered in the system');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Invalid password');
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password');
    } else if (error.message && error.message.includes('not found in database')) {
      throw error;
    } else if (error.message && error.message.includes('suspended')) {
      throw error;
    }
    console.error('Error logging in:', error);
    throw new Error('Login failed: ' + (error.message || 'Unknown error'));
  }
};

/**
 * Logout user
 */
export const logoutUser = async () => {
  try {
    // Clear FCM token from Firestore if it exists so shared devices don't receive cross-account pushes
    const user = auth.currentUser;
    if (user && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const { messaging } = await import('./firebase');
        const { getToken } = await import('firebase/messaging');
        const { doc, updateDoc, arrayRemove } = await import('firebase/firestore');
        const VAPID_KEY = 'BCQ5naTxjzLBGg5LAr8mdjvmWMdhHJ6NhECt7Zm1Heu7RPch5_sCH1ILKeOJotIArRjaHkNFet6N9S9tQLVX5t4';
        
        if (messaging) {
          const token = await getToken(messaging, { vapidKey: VAPID_KEY });
          if (token) {
            await updateDoc(doc(db, 'users', user.uid), {
              fcmTokens: arrayRemove(token)
            });
          }
        }
      } catch (e) {
        console.warn('Failed to remove FCM token on logout', e);
      }
    }

    // Sign out from Firebase if signed in
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

/**
 * Setup auth state listener
 * Supports both Firebase auth and mock auth (for testing)
 */
export const setupAuthListener = (callback) => {
  // Set up Firebase listener
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    callback(user);
  });

  return unsubscribe;
};
