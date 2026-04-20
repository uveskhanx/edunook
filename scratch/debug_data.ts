
import { db } from '../src/lib/firebase';
import { ref, get } from 'firebase/database';

async function debugData() {
  const snapshot = await get(ref(db, 'courses'));
  if (snapshot.exists()) {
    const courses: Record<string, any> = snapshot.val();
    const firstFew = Object.values(courses).slice(0, 5);
    console.log('Sample Courses:', JSON.stringify(firstFew, null, 2));
  } else {
    console.log('No courses found');
  }
}

debugData().catch(console.error);
