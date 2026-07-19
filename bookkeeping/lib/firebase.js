import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';

let app = null;
let auth = null;
let googleProvider = null;

// Initialize Firebase only on client side and if config is available
const initializeFirebase = () => {
  if (typeof window === 'undefined') return null;
  
  if (app) return { app, auth, googleProvider };

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Check if required config is present
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration is missing. Authentication features will be disabled.');
    return null;
  }

  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Enable persistent sessions
    auth.setPersistence('local'); // Keeps user signed in until manual sign out
    
    return { app, auth, googleProvider };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
};

// Authentication functions
export const signInWithEmail = async (email, password) => {
  const { auth } = initializeFirebase() || {};
  if (!auth) throw new Error('Firebase is not configured');
  return await signInWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = async () => {
  const { auth, googleProvider } = initializeFirebase() || {};
  if (!auth || !googleProvider) throw new Error('Firebase is not configured');
  return await signInWithPopup(auth, googleProvider);
};

export const signOut = async () => {
  const { auth } = initializeFirebase() || {};
  if (!auth) throw new Error('Firebase is not configured');
  return await firebaseSignOut(auth);
};

export const getCurrentUser = () => {
  const { auth } = initializeFirebase() || {};
  return auth ? auth.currentUser : null;
};

export const onAuthChange = (callback) => {
  const { auth } = initializeFirebase() || {};
  if (!auth) {
    // Return a no-op unsubscribe function if Firebase is not configured
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const isFirebaseConfigured = () => {
  return !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
};
