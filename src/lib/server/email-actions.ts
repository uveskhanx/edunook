import { createServerFn } from '@tanstack/react-start';
import { Resend } from 'resend';
import { adminAuth } from './admin';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
  email: z.string().email(),
  fullName: z.string()
});

export const sendVerificationEmailAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => emailSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, fullName } = data;
    console.log(`[EmailAction] Attempting to send verification to: ${email}`);

    try {
      // 1. Generate the Firebase verification link
      const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost:8080';
      const actionCodeSettings = {
        url: `${process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : `https://${authDomain}`}/login`,
        handleCodeInApp: false,
      };

      const link = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);
      console.log(`[EmailAction] Generated link for ${email}`);

      // 2. Send the premium email via Resend
      const { data: resendData, error } = await resend.emails.send({
        from: 'EduNook <onboarding@resend.dev>',
        to: [email],
        subject: `Verify your account, ${fullName.split(' ')[0]}!`,
        html: `
          <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 24px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 32px; font-weight: 900; margin: 0; background: linear-gradient(to right, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">EduNook</h1>
            </div>

            <div style="background-color: rgba(255,255,255,0.03); padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
              <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Welcome!</h2>
              <p style="color: #a1a1aa; line-height: 1.6; font-size: 15px;">
                Hello ${fullName},<br/><br/>
                We're excited to have you on board! To finish setting up your student account, please verify your email address.
              </p>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${link}" style="background-color: #3b82f6; color: white; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: 900; font-size: 16px;">
                  Verify Account
                </a>
              </div>

              <p style="color: #71717a; font-size: 12px; text-align: center; margin-bottom: 0;">
                If you didn't create an account, you can ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 32px; color: #52525b; font-size: 12px;">
              &copy; ${new Date().getFullYear()} EduNook — Your Learning Hub
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('[EmailAction] Resend Error:', error);
        throw error;
      }

      console.log(`[EmailAction] Successfully sent email to ${email}`);
      return { success: true, data: resendData };
    } catch (err: any) {
      console.error('Server Email Error:', err);
      throw new Error(err.message || 'Internal server error');
    }
  });

const resetSchema = z.object({
  username: z.string().min(3)
});

export const sendPasswordResetAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async ({ data }) => {
    const { username } = data;
    const adminDb = (await import('./admin')).adminDb;
    const adminAuth = (await import('./admin')).adminAuth;

    console.log(`[EmailAction] Starting password reset for: ${username}`);

    try {
      // 1. Resolve Username to UID and Real Email
      const usernameSnapshot = await adminDb.ref(`usernames/${username.toLowerCase()}`).get();
      if (!usernameSnapshot.exists()) {
        throw new Error('Username not found');
      }

      const uid = usernameSnapshot.val();
      const userSnapshot = await adminDb.ref(`users/${uid}`).get();
      if (!userSnapshot.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userSnapshot.val();
      const realEmail = userData.realEmail || userData.email;
      const internalEmail = userData.email; // username@edunook.com

      console.log(`[EmailAction] Found recovery details. Real: ${realEmail}, Internal: ${internalEmail}`);

      // 2. Generate Reset Link (for the internal email)
      const actionCodeSettings = {
        url: `${process.env.VITE_FRONTEND_URL || 'http://localhost:8080'}/login`,
        handleCodeInApp: false,
      };

      const link = await adminAuth.generatePasswordResetLink(internalEmail, actionCodeSettings);

      // 3. Send Email via Resend to the REAL Email
      const { data: resendData, error } = await resend.emails.send({
        from: 'EduNook <security@resend.dev>',
        to: [realEmail],
        subject: `Reset your EduNook password, @${username}`,
        html: `
          <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 24px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 32px; font-weight: 900; margin: 0; background: linear-gradient(to right, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">EduNook Security</h1>
            </div>

            <div style="background-color: rgba(255,255,255,0.03); padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
              <h2 style="font-size: 20px; font-weight: 700; margin-top: 0;">Password Reset</h2>
              <p style="color: #a1a1aa; line-height: 1.6; font-size: 15px;">
                Hello @${username},<br/><br/>
                We received a request to reset your password. Click the secure button below to choose a new password. 
                This link is unique to your <b>@${username}</b> account.
              </p>

              <div style="text-align: center; margin: 40px 0;">
                <a href="${link}" style="background-color: #3b82f6; color: white; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: 900; font-size: 16px;">
                  Set New Password
                </a>
              </div>

              <p style="color: #71717a; font-size: 12px; text-align: center;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 32px; color: #52525b; font-size: 12px;">
              &copy; ${new Date().getFullYear()} EduNook — Your Learning Hub
            </div>
          </div>
        `,
      });

      if (error) throw error;
      return { success: true };

    } catch (err: any) {
      console.error('[EmailAction] Password Reset Error:', err);
      throw new Error(err.message || 'Recovery failed');
    }
  });

const feedbackSchema = z.object({
  email: z.string().email(),
  type: z.string(),
  message: z.string(),
  username: z.string()
});

export const sendFeedbackEmailAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => feedbackSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, type, message, username } = data;
    console.log(`[EmailAction] Sending feedback from: ${username} (${email})`);

    try {
      const { data: resendData, error } = await resend.emails.send({
        from: 'EduNook Feedback <feedback@resend.dev>',
        to: ['learningaurstudywala@gmail.com'],
        subject: `[${type.toUpperCase()}] New Feedback from @${username}`,
        html: `
          <div style="font-family: 'Inter', sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 24px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 24px; font-weight: 900; margin: 0; color: #3b82f6;">EduNook Support</h1>
            </div>

            <div style="background-color: rgba(255,255,255,0.03); padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
              <div style="margin-bottom: 24px;">
                <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6; background: rgba(59,130,246,0.1); padding: 4px 12px; border-radius: 100px; border: 1px solid rgba(59,130,246,0.2);">
                  ${type}
                </span>
              </div>
              
              <p style="color: #ffffff; line-height: 1.6; font-size: 16px; margin-bottom: 32px; white-space: pre-wrap;">${message}</p>

              <div style="border-top: 1px solid rgba(255,255,255,0.05); pt: 24px; margin-top: 24px;">
                <p style="color: #71717a; font-size: 12px; margin: 4px 0;"><b>Sender:</b> @${username}</p>
                <p style="color: #71717a; font-size: 12px; margin: 4px 0;"><b>Email:</b> ${email}</p>
                <p style="color: #71717a; font-size: 12px; margin: 4px 0;"><b>Date:</b> ${new Date().toLocaleString()}</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 32px; color: #52525b; font-size: 12px;">
              This feedback was sent from the EduNook Settings page.
            </div>
          </div>
        `,
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('[EmailAction] Feedback Error:', err);
      throw new Error(err.message || 'Failed to send feedback');
    }
  });

