import { readFileSync } from 'fs';
import admin from 'firebase-admin';

const envContent = readFileSync('./.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.+)'/s);
const rawJson = match[1].replace(/\\\\n/g, '\\n');
const serviceAccount = JSON.parse(rawJson);

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://edunook-website-default-rtdb.asia-southeast1.firebasedatabase.app',
});

async function run() {
  const db = admin.database();
  const profilesSnap = await db.ref('profiles').once('value');
  const profiles = profilesSnap.val() || {};
  
  for (const [uid, profile] of Object.entries(profiles)) {
    if (profile.history) {
      console.log(`User ${uid} history:`, Object.keys(profile.history));
    }
  }
  
  const coursesSnap = await db.ref('courses').once('value');
  const courses = coursesSnap.val() || {};
  console.log(`Total courses: ${Object.keys(courses).length}`);
  for (const [cId, c] of Object.entries(courses)) {
     if (!c.isPublished) {
       console.log(`Course ${c.title} is NOT published.`);
     } else {
       console.log(`Course ${c.title} IS published. Price: ${c.price}`);
     }
  }
  process.exit(0);
}
run();
