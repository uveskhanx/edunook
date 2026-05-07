import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { publicEnv } from './public-env';
const firebaseConfig = {
  apiKey: publicEnv.firebaseApiKey,
  authDomain: publicEnv.firebaseAuthDomain,
  databaseURL: publicEnv.firebaseDatabaseURL,
  projectId: publicEnv.firebaseProjectId,
  storageBucket: publicEnv.firebaseStorageBucket,
  messagingSenderId: publicEnv.firebaseMessagingSenderId,
  appId: publicEnv.firebaseAppId,
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseKeys.length > 0) {
  throw new Error(`Missing Firebase configuration: ${missingFirebaseKeys.join(', ')}`);
}

// Initialize Firebase (Check if already initialized to prevent duplicate app error)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
export default app;
