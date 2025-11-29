import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration
// Uses environment variables if provided, otherwise falls back to the supplied project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCPGu7mgL9jYnSGbhEU9_L8TM7YStcs6yw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trend-60388.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trend-60388",
  // Storage bucket must be the appspot.com bucket, not firebasestorage.app
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trend-60388.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "556257364266",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:556257364266:web:d12e96ab0d88a4b391f653",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FL25931ZMS",
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Connect to auth emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch {}
}

export default app; 