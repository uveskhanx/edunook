import admin from 'firebase-admin';

// Initialize Firebase Admin singleton
export function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
  const serviceAccount = JSON.parse(saRaw);

  // Fix private key formatting
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

const adminApp = getAdminApp();
export const adminAuth = adminApp ? adminApp.auth() : admin.auth();
export const adminDb = adminApp ? adminApp.database() : admin.database();
