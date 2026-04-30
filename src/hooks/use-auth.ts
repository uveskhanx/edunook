import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { DbService, Profile } from '@/lib/db-service';

export type AuthUser = {
  id: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
} | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveProfile(fbUser: any): Promise<Profile | null> {
  let profile = await DbService.getProfile(fbUser.uid);

  if (profile) {
    // Run Subscription Guard to check for expirations and send warnings
    const { SubscriptionGuard } = await import('@/lib/subscription-guard');
    profile = await SubscriptionGuard.checkAndSync(profile);
  }

  // Always ensure a profile exists regardless of displayName
  if (!profile) {
    const map = await DbService.ensureUsernameMapLoaded();
    const username = map[fbUser.uid] || fbUser.email?.split('@')[0] || fbUser.uid.substring(0, 8);
    const resolvedName = fbUser.displayName || fbUser.email?.split('@')[0] || username;
    const newProfile: Profile = {
      uid: fbUser.uid,
      fullName: resolvedName,
      username,
      email: fbUser.email || '',
      role: 'student',
      createdAt: new Date().toISOString(),
    };
    await DbService.updateProfile(fbUser.uid, newProfile);
    profile = newProfile;
  } else if (profile.fullName === profile.username && fbUser.displayName) {
    // Profile exists but fullName was a username fallback — upgrade it
    await DbService.updateProfile(fbUser.uid, { fullName: fbUser.displayName });
    profile = { ...profile, fullName: fbUser.displayName };
  }

  // Silently backfill real name onto any courses missing publisherName
  if (profile?.fullName) {
    DbService.backfillCoursePublisherNames(fbUser.uid, profile.fullName).catch(() => { });
  }

  return profile;
}

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
          const profile = await resolveProfile(fbUser);
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

  // Allows components to manually re-fetch and re-scaffold the profile
  // (useful when the auth state fired before the scaffold fix was deployed)
  const refreshProfile = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    try {
      const profile = await resolveProfile(fbUser);
      setDbUser(profile);
    } catch (err) {
      console.error('[useAuth] refreshProfile failed:', err);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { user, dbUser, loading, signOut, refreshProfile };
}
