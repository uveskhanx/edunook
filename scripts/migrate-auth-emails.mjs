import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const apply = process.argv.includes('--apply');
const verbose = process.argv.includes('--verbose');
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
const serviceAccount = JSON.parse(saRaw);

if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

const auth = admin.auth();
const db = admin.database();

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function run() {
  const usersSnapshot = await db.ref('users').get();
  const users = usersSnapshot.val() || {};
  const candidates = Object.entries(users)
    .map(([uid, user]) => ({
      uid,
      currentEmail: normalizeEmail(user?.email),
      realEmail: normalizeEmail(user?.realEmail),
    }))
    .filter((entry) => entry.realEmail);

  const summary = {
    apply,
    candidates: candidates.length,
    updatedAuth: 0,
    updatedDb: 0,
    skipped: 0,
    sample: [],
    failures: [],
  };

  for (const candidate of candidates) {
    try {
      const userRecord = await auth.getUser(candidate.uid);
      const targetEmail = candidate.realEmail;
      const needsAuthUpdate = normalizeEmail(userRecord.email) !== targetEmail;
      const needsDbUpdate = candidate.currentEmail !== targetEmail;

      if (!apply) {
        if (verbose || summary.sample.length < 20) {
          summary.sample.push({
            uid: candidate.uid,
            authEmail: userRecord.email || null,
            dbEmail: candidate.currentEmail || null,
            targetEmail,
            needsAuthUpdate,
            needsDbUpdate,
          });
        }
        continue;
      }

      if (needsAuthUpdate) {
        await auth.updateUser(candidate.uid, { email: targetEmail });
        summary.updatedAuth += 1;
      }

      const updates = {
        [`users/${candidate.uid}/email`]: targetEmail,
        [`users/${candidate.uid}/realEmail`]: null,
        [`profiles/${candidate.uid}/email`]: null,
        [`profiles/${candidate.uid}/realEmail`]: null,
      };

      await db.ref().update(updates);
      summary.updatedDb += 1;
    } catch (error) {
      summary.failures.push({
        uid: candidate.uid,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!apply) {
    summary.skipped = candidates.length;
  }

  console.log(JSON.stringify(summary, null, 2));
  await admin.app().delete();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
