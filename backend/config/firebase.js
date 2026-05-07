import admin from 'firebase-admin';
import { env } from './env.js';

function parseServiceAccount() {
  const parsed = JSON.parse(env.firebaseServiceAccount);
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(parseServiceAccount()),
    databaseURL: env.firebaseDatabaseURL,
  });
}

export const db = admin.database();
export { admin };
