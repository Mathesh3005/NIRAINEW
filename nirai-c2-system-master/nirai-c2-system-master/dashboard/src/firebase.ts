import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBKYowgbbyApg-jbjJUwXQh69DHtxKJUvU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "siteon-47a8f.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://siteon-47a8f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "siteon-47a8f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "siteon-47a8f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "456723565570",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:456723565570:web:af88c744fb6ab047076b1b"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
