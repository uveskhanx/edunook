import { z } from 'zod';

const usernameSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/i, 'Use a valid EduNook username'),
});

export async function resolveAuthEmailAction({ data }: { data: unknown }) {
  const { username } = usernameSchema.parse(data);
  const normalizedUsername = username.toLowerCase();
  const { adminDb } = await import('./admin');

  const usernameSnapshot = await adminDb.ref(`usernames/${normalizedUsername}`).get();
  if (!usernameSnapshot.exists()) {
    throw new Error('Username not found');
  }

  const uid = usernameSnapshot.val();
  const userSnapshot = await adminDb.ref(`users/${uid}`).get();
  if (!userSnapshot.exists()) {
    throw new Error('User profile not found');
  }

  const userData = userSnapshot.val() || {};
  const authEmail = userData.email || userData.realEmail;

  if (!authEmail || typeof authEmail !== 'string') {
    throw new Error('No login email found for this account');
  }

  return {
    success: true,
    email: authEmail.toLowerCase().trim(),
  };
}
