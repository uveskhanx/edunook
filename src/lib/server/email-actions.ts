import { z } from 'zod';

const feedbackSchema = z.object({
  data: z.object({
    email: z.string().email(),
    type: z.string(),
    message: z.string(),
    username: z.string(),
    userId: z.string().optional(),
  }),
});

export async function sendFeedbackEmailAction({ data }: { data: unknown }) {
  const { data: feedback } = feedbackSchema.parse(data);
  const { email, type, message, username, userId } = feedback;

  try {
    const adminDb = (await import('./admin')).adminDb;
    const feedbackRef = adminDb.ref('feedback').push();
    await feedbackRef.set({
      type,
      message,
      email,
      username,
      userId: userId || 'system',
      createdAt: new Date().toISOString(),
    });

    const usernameSnapshot = await adminDb.ref('usernames/edunook').get();
    if (!usernameSnapshot.exists()) {
      throw new Error('Admin account @edunook was not found');
    }

    const edunookUid = usernameSnapshot.val();
    const reporterId = userId || (await adminDb.ref(`usernames/${username.toLowerCase()}`).get()).val() || 'system';

    const participants = [reporterId, edunookUid].sort();
    const chatId = participants.join('_');
    const now = new Date().toISOString();

    const messagesRef = adminDb.ref(`messages/${chatId}`).push();
    const messageId = messagesRef.key;
    await messagesRef.set({
      id: messageId,
      senderId: reporterId,
      text: `[SYSTEM SIGNAL: ${type}]\n${message}`,
      createdAt: now,
      seen: false,
    });

    await adminDb.ref(`chats/${chatId}`).update({
      lastMessage: `${type}: Signal Received`,
      updatedAt: now,
      lastSenderId: reporterId,
      [`users/${reporterId}`]: true,
      [`users/${edunookUid}`]: true,
    });

    await adminDb.ref(`user_chats/${reporterId}/${chatId}`).set(true);
    await adminDb.ref(`user_chats/${edunookUid}/${chatId}`).set(true);
    await adminDb.ref(`chats/${chatId}/unreadCounts/${edunookUid}`).transaction((c: any) => (c || 0) + 1);

    if (reporterId !== 'system' && messageId) {
      await adminDb.ref(`user_settings/${reporterId}/deletedMessages/${chatId}/${messageId}`).set(true);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[EmailAction] Feedback Error:', err);
    throw new Error(err.message || 'Failed to send feedback');
  }
}
