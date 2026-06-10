// Firebase configuration using environment variables for security
// Fallback to hardcoded values if env vars are not set (for development)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB0a8AP88OrZLZdx7CYWLQZQfknkwbj6yw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trisphere-4b121.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trisphere-4b121",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trisphere-4b121.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "906769842576",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:906769842576:web:0b8c46cba1a6d9e7e7b315",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-272L22WF7P"
};