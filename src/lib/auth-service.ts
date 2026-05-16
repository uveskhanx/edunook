import { 
  sendPasswordResetEmail, 
  confirmPasswordReset, 
  signOut as firebaseSignOut,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from './firebase';
import { resolveAuthEmailAction } from './client-actions';

function getActionUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}${path}`;
  }

  const configuredBase =
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://edunook-io.vercel.app';

  const normalizedBase = /^https?:\/\//i.test(configuredBase)
    ? configuredBase.replace(/\/+$/, '')
    : `https://${configuredBase}`.replace(/\/+$/, '');

  return `${normalizedBase}${path}`;
}

export const AuthService = {
  async resolveAuthEmail(username: string): Promise<string> {
    const result = await resolveAuthEmailAction({ data: { username } });
    return result.email;
  },

  async sendResetPasswordEmail(username: string): Promise<void> {
    const email = await this.resolveAuthEmail(username);
    await sendPasswordResetEmail(auth, email, {
      url: getActionUrl('/login'),
    });
  },

  async resetPassword(code: string, newPass: string): Promise<void> {
    await confirmPasswordReset(auth, code, newPass);
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendVerificationEmail(user?: any): Promise<void> {
    if (!user) {
      throw new Error('No authenticated user found');
    }

    await sendEmailVerification(user, {
      url: getActionUrl('/login'),
    });
  },

  async reloadUser(): Promise<void> {
    if (auth.currentUser) {
      await auth.currentUser.reload();
    }
  }
};
