import { readFileSync } from 'fs';
import admin from 'firebase-admin';

// Read service account directly from .env file
const envContent = readFileSync('./.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT='(.+)'/s);
if (!match) {
  console.error('Could not find FIREBASE_SERVICE_ACCOUNT in .env');
  process.exit(1);
}

const rawJson = match[1].replace(/\\\\n/g, '\\n');
const serviceAccount = JSON.parse(rawJson);

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://edunook-website-default-rtdb.asia-southeast1.firebasedatabase.app',
});

const rules = readFileSync('./database.rules.json', 'utf-8');

async function deployRules() {
  const db = admin.database();
  
  // Use the Admin SDK's internal method to set rules
  // The Admin SDK authenticates with full admin privileges
  const dbRef = db.ref('/');
  
  // Get database rules via the REST endpoint using Admin SDK token
  const tokenResult = await admin.credential.cert(serviceAccount).getAccessToken();
  const token = tokenResult.access_token;
  
  const response = await fetch(
    `https://edunook-website-default-rtdb.asia-southeast1.firebasedatabase.app/.settings/rules.json`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: rules,
    }
  );

  if (response.ok) {
    console.log('✅ Database rules deployed successfully!');
  } else {
    const text = await response.text();
    console.error('❌ Failed:', response.status, text);
  }
  
  process.exit(0);
}

deployRules().catch(err => { console.error(err); process.exit(1); });
