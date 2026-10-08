import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let dbInstance = null;
let authInstance = null;

try {
  const apps = getApps();
  const app = apps.length
    ? apps[0]
    : initializeApp({ projectId: 'siteon-47a8f' });
  authInstance = getAuth(app);

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG || process.env.NODE_ENV === 'production') {
    dbInstance = getFirestore(app);
    console.log('[NIRAI Firebase Admin] Firestore initialized for siteon-47a8f');
  } else {
    console.log('[NIRAI Firebase Admin] Token verification enabled; Firestore writes disabled in local mode');
  }
} catch (err) {
  console.warn('[NIRAI Firebase Admin] Initialization failed:', err.message);
}

export const adminAuth = authInstance;
export const db = dbInstance;
export default dbInstance;
