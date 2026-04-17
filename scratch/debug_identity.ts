
import { db } from './src/lib/firebase';
import { ref, get } from 'firebase/database';

async function debugData() {
  const snapshot = await get(ref(db, 'courses'));
  if (snapshot.exists()) {
    const courses = snapshot.val();
    const targeted = ['last time sending', 'last working', 'final testing yaar'];

    console.log('--- TARGETED COURSES RAW DATA ---');
    for (const key in courses) {
      if (targeted.some(t =\u003e courses[key].title?.toLowerCase().includes(t.toLowerCase()))) {
        console.log(`Course ID: ${key}`);
        console.log(JSON.stringify(courses[key], null, 2));

        // Check if the userId exists in users or profiles
        const uid = courses[key].userId;
        if (uid) {
          const [uSnap, pSnap] = await Promise.all([
            get(ref(db, `users/${uid}`)),
            get(ref(db, `profiles/${uid}`))
          ]);
          console.log(`User Exists: ${uSnap.exists()}`);
          console.log(`Profile Exists: ${pSnap.exists()}`);
        }
        console.log('-------------------------------');
      }
    }
  } else {
    console.log('No courses found');
  }
}

debugData().catch(console.error);
