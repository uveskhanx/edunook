/* eslint-disable @typescript-eslint/no-explicit-any */
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
          <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 32px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="font-size: 36px; font-weight: 900; margin: 0; letter-spacing: -0.04em; background: linear-gradient(to right, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">EduNook</h1>
              <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; color: rgba(255,255,255,0.2); margin-top: 8px;">Your Learning Hub</p>
            </div>

            <div style="background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <h2 style="font-size: 24px; font-weight: 900; margin-top: 0; margin-bottom: 16px; color: #ffffff;">Welcome to the future.</h2>
              <p style="color: rgba(255,255,255,0.4); line-height: 1.8; font-size: 15px; font-weight: 500; margin-bottom: 32px;">
                Hello ${fullName},<br/>
                We're excited to have you on board! To unlock your full student experience, please confirm your email address below.
              </p>

              <div style="margin: 40px 0;">
                <a href="${link}" style="background-color: #ffffff; color: #000000; padding: 18px 40px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block; box-shadow: 0 10px 30px rgba(255,255,255,0.1);">
                  Verify Account
                </a>
              </div>

              <p style="color: rgba(255,255,255,0.15); font-size: 11px; margin-bottom: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                This link will expire soon for your security.
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; color: rgba(255,255,255,0.1); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em;">
              &copy; ${new Date().getFullYear()} EduNook Inc. &bull; Secure Onboarding
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
        from: 'EduNook Security <security@resend.dev>',
        to: [realEmail],
        subject: `Reset your EduNook password, @${username}`,
        html: `
          <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 32px; max-width: 600px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -0.04em; color: #ffffff;">EduNook <span style="color: #6366f1;">Security</span></h1>
            </div>

            <div style="background-color: rgba(255,255,255,0.02); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <h2 style="font-size: 20px; font-weight: 900; margin-top: 0; color: #ffffff;">Password Recovery</h2>
              <p style="color: rgba(255,255,255,0.4); line-height: 1.8; font-size: 15px; margin-bottom: 32px;">
                Hello @${username},<br/><br/>
                We received a request to reset your password. Click the secure button below to choose a new password for your account.
              </p>

              <div style="margin: 40px 0;">
                <a href="${link}" style="background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; padding: 18px 40px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block;">
                  Set New Password
                </a>
              </div>

              <p style="color: rgba(255,255,255,0.2); font-size: 11px; margin-bottom: 0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 40px; color: rgba(255,255,255,0.1); font-size: 10px; font-weight: 700; text-transform: uppercase;">
              &copy; ${new Date().getFullYear()} EduNook — Account Protection
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
  data: z.object({
    email: z.string().email(),
    type: z.string(),
    message: z.string(),
    username: z.string(),
    userId: z.string().optional()
  })
});

export const sendFeedbackEmailAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => feedbackSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, type, message, username, userId } = data.data;
    console.log(`[EmailAction] Sending feedback from: ${username} (${email})`);

    try {
      // 1. Store in Global Feedback Node
      const adminDb = (await import('./admin')).adminDb;
      const feedbackRef = adminDb.ref('feedback').push();
      await feedbackRef.set({
        type,
        message,
        email,
        username,
        userId: userId || 'system',
        createdAt: new Date().toISOString()
      });

      // 2. Route to "edunook" Admin Chat
      const usernameSnapshot = await adminDb.ref(`usernames/edunook`).get();
      if (usernameSnapshot.exists()) {
        const edunookUid = usernameSnapshot.val();
        const reporterId = userId || (await adminDb.ref(`usernames/${username.toLowerCase()}`).get()).val() || 'system';
        
        const participants = [reporterId, edunookUid].sort();
        const chatId = participants.join('_');
        const now = new Date().toISOString();

        // Push chat message
        const messagesRef = adminDb.ref(`messages/${chatId}`).push();
        const messageId = messagesRef.key;
        await messagesRef.set({
          id: messageId,
          senderId: reporterId,
          text: `[SYSTEM SIGNAL: ${type}]\n${message}`,
          createdAt: now,
          seen: false
        });

        // Update chat metadata and user chats index
        await adminDb.ref(`chats/${chatId}`).update({
          lastMessage: `${type}: Signal Received`,
          updatedAt: now,
          lastSenderId: reporterId,
          [`users/${reporterId}`]: true,
          [`users/${edunookUid}`]: true
        });

        // Ensure chat appears in both users' sidebars
        await adminDb.ref(`user_chats/${reporterId}/${chatId}`).set(true);
        await adminDb.ref(`user_chats/${edunookUid}/${chatId}`).set(true);
        
        // Increment unread for edunook
        await adminDb.ref(`chats/${chatId}/unreadCounts/${edunookUid}`).transaction((c: any) => (c || 0) + 1);

        // If it's an Account Report, mask it from the reporter
        if (type === 'Account Report' && reporterId !== 'system') {
          await adminDb.ref(`user_settings/${reporterId}/deletedMessages/${chatId}/${messageId}`).set(true);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('[EmailAction] Feedback Error:', err);
      throw new Error(err.message || 'Failed to send feedback');
    }
  });

const signupOtpSchema = z.object({
  email: z.string().email(),
  username: z.string()
});

export const sendSignupOTPEmailAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupOtpSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, username } = data;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const adminDb = (await import('./admin')).adminDb;
    
    try {
      // 1. Store OTP in DB (expires in 10 mins)
      await adminDb.ref(`temp_otps/${email.replace(/\./g, '_')}`).set({
        code: otp,
        expiresAt: Date.now() + 600000 
      });

      // 2. Send Email
      await resend.emails.send({
        from: 'EduNook Verification <verify@resend.dev>',
        to: [email],
        subject: `${otp} is your EduNook verification code`,
        html: `
          <div style="font-family: 'Inter', sans-serif; background-color: #050505; color: #ffffff; padding: 40px; border-radius: 32px; max-width: 500px; margin: auto; border: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="font-size: 28px; font-weight: 900; margin: 0; color: #ffffff;">EduNook</h1>
              <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: rgba(255,255,255,0.2); margin-top: 8px;">Verification Service</p>
            </div>

            <div style="background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%); padding: 40px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 32px; font-weight: 500;">Hello @${username}, enter the code below to secure your new account.</p>
              
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 32px; border-radius: 20px; margin: 24px 0;">
                <span style="font-size: 48px; font-weight: 900; letter-spacing: 0.3em; color: #ffffff; font-family: 'Courier New', monospace;">${otp}</span>
              </div>

              <p style="color: rgba(255,255,255,0.15); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Valid for 10 minutes</p>
            </div>
            
            <div style="text-align: center; margin-top: 40px; color: rgba(255,255,255,0.05); font-size: 9px; font-weight: 700; text-transform: uppercase;">
              Automatic Security Notification
            </div>
          </div>
        `,
      });

      return { success: true };
    } catch (err: any) {
      console.error('[EmailAction] Signup OTP Error:', err);
      throw new Error('Failed to send verification email');
    }
  });

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6)
});

export const verifySignupOTPAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifyOtpSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, code } = data;
    const adminDb = (await import('./admin')).adminDb;
    const ref = adminDb.ref(`temp_otps/${email.replace(/\./g, '_')}`);
    const snapshot = await ref.get();
    
    if (!snapshot.exists()) throw new Error('OTP expired or not found');
    
    const { code: storedCode, expiresAt } = snapshot.val();
    if (Date.now() > expiresAt) {
      await ref.remove();
      throw new Error('OTP expired');
    }
    
    if (storedCode !== code) throw new Error('Invalid verification code');
    
    await ref.remove(); 
    return { success: true };
  });
