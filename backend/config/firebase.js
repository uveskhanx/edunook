import admin from 'firebase-admin';
import { env } from './env.js';

function parseServiceAccount() {
  try {
    const parsed = JSON.parse(env.firebaseServiceAccount);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    console.error('[CONFIG ERROR] Invalid FIREBASE_SERVICE_ACCOUNT JSON. Please check your Render environment variables.');
    throw err;
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parseServiceAccount()),
    databaseURL: env.firebaseDatabaseURL,
  });
}

export const db = admin.database();
export { admin };
