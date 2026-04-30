import { 
  sendPasswordResetEmail, 
  confirmPasswordReset, 
  signOut as firebaseSignOut,
  sendEmailVerification
} from 'firebase/auth';
import { auth } from './firebase';
import { DbService } from './db-service';
import { sendPasswordResetAction } from './server/email-actions';

export const AuthService = {
  getInternalEmail(username: string): string {
    const cleanUsername = username.toLowerCase().trim();
    return `${cleanUsername}@edunook.internal`;
  },

   async sendResetPasswordEmail(username: string): Promise<void> {
    const result = await sendPasswordResetAction({ data: { username } });
    if (!result.success) {
      throw new Error('Recovery initiative failed. Please verify your username.');
    }
  },

  async resetPassword(code: string, newPass: string): Promise<void> {
    await confirmPasswordReset(auth, code, newPass);
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendVerificationEmail(user?: any): Promise<void> {
    // Deprecated: We no longer use email verification
    return;
  },

  async reloadUser(): Promise<void> {
    if (auth.currentUser) {
      await auth.currentUser.reload();
    }
  }
};
