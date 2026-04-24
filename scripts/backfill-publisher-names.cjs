const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://edunook-website-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const db = admin.database();
const authAdmin = admin.auth();

async function backfillEverything() {
  const nodes = ['courses', 'tests', 'chapters', 'posts'];
  const allUids = new Set();
  
  console.log('Scanning database nodes:', nodes.join(', '));
  
  const nodeSnapshots = {};
  for (const node of nodes) {
    const snap = await db.ref(node).get();
    if (snap.exists()) {
      nodeSnapshots[node] = snap.val();
      Object.values(nodeSnapshots[node]).forEach(item => {
        const uid = item.userId || item.creatorId || item.authorId;
        if (uid) allUids.add(uid);
      });
    }
  }
  
  console.log('Found unique UIDs:', [...allUids]);
  
  const updates = {};
  for (const uid of allUids) {
    let name = null;
    let username = null;
    
    // 1. Try Firebase Auth
    try {
      const userRecord = await authAdmin.getUser(uid);
      name = userRecord.displayName || (userRecord.email ? userRecord.email.split('@')[0] : null);
      username = userRecord.email ? userRecord.email.split('@')[0] : null;
    } catch (err) {
      console.warn(`UID ${uid} not found in Auth, checking profiles node...`);
    }

    // 2. Try Profiles node if Auth failed or name is missing
    if (!name) {
      const profileSnap = await db.ref('profiles/' + uid).get();
      if (profileSnap.exists()) {
        const profile = profileSnap.val();
        name = profile.fullName || profile.name;
        username = profile.username;
      }
    }

    // 3. Last resort fallback
    if (!name) name = 'Educator';
    if (!username) username = uid.substring(0, 8);

    console.log(`Resolved UID: ${uid} -> Name: ${name}`);

    // Backfill all nodes
    for (const node of nodes) {
      if (nodeSnapshots[node]) {
        Object.entries(nodeSnapshots[node]).forEach(([id, item]) => {
          const itemUid = item.userId || item.creatorId || item.authorId;
          if (itemUid === uid && !item.publisherName) {
            updates[`${node}/${id}/publisherName`] = name;
          }
        });
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
    console.log(`SUCCESS: Applied ${Object.keys(updates).length} publisherName updates across all nodes!`);
  } else {
    console.log('DONE: All records already have publisherName.');
  }
  process.exit(0);
}

backfillEverything().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
