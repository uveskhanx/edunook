
import { db } from '../src/lib/firebase';
import { ref, get } from 'firebase/database';

async function debug() {
  const snapshot = await get(ref(db, 'courses'));
  const courses: any = snapshot.val();
  for (const id in courses) {
    const c = courses[id];
    if (['last time sending', 'last working', 'final testing yaar'].some(t => c.title?.includes(t))) {
      console.log('Course ID:', id);
      console.log('Title:', c.title);
      console.log('userId:', c.userId);
      console.log('creatorName:', c.creatorName);
      console.log('publisherName:', c.publisherName);
      
      const userSnap = await get(ref(db, `users/${c.userId}`));
      console.log('User Exists:', userSnap.exists());
      if (userSnap.exists()) console.log('User Data:', userSnap.val());
      
      const profSnap = await get(ref(db, `profiles/${c.userId}`));
      console.log('Profile Exists:', profSnap.exists());
      if (profSnap.exists()) console.log('Profile Data:', profSnap.val());
      console.log('---');
    }
  }
}

debug().catch(console.error);
