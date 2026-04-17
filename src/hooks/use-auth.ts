import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { DbService, Profile } from '@/lib/db-service';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
} | null;

export function useAuth() {
  const [user, setUser] = useState<AuthUser>(null);
  const [dbUser, setDbUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser({
          id: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          emailVerified: fbUser.emailVerified,
        });
        
        try {
          let profile = await DbService.getProfile(fbUser.uid);
          
          // Auto-scaffold: If profile is missing or only has a username-derived name,
          // and Firebase Auth has a real displayName, save it to RTDB
          const authDisplayName = fbUser.displayName;
          if (authDisplayName) {
            if (!profile) {
              // No profile at all — create one from Firebase Auth data
              const map = await DbService.ensureUsernameMapLoaded();
              const username = map[fbUser.uid] || fbUser.email?.split('@')[0] || fbUser.uid.substring(0, 8);
              const newProfile: Profile = {
                uid: fbUser.uid,
                fullName: authDisplayName,
                username,
                email: fbUser.email || '',
                role: 'student',
                createdAt: new Date().toISOString(),
              };
              await DbService.updateProfile(fbUser.uid, newProfile);
              profile = newProfile;
            } else if (profile.fullName === profile.username) {
              // Profile exists but fullName was set to username (our fallback) — fix it
              await DbService.updateProfile(fbUser.uid, { fullName: authDisplayName });
              profile = { ...profile, fullName: authDisplayName };
            }
          }
          
          setDbUser(profile);
        } catch (err) {
          console.error('Error fetching db user in auth hook:', err);
        }
      } else {
        setUser(null);
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { user, dbUser, loading, signOut };
}
