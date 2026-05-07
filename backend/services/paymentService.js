import { db } from '../config/firebase.js';

export function toPaise(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

export function splitCourseAmount(amountPaise) {
  const teacherAmount = Math.floor(amountPaise * 0.65);
  const platformAmount = amountPaise - teacherAmount;
  return { teacherAmount, platformAmount };
}

export async function getCourseForPayment(courseId) {
  const snapshot = await db.ref(`courses/${courseId}`).get();
  if (!snapshot.exists()) return null;
  return { id: courseId, ...snapshot.val() };
}

export async function getTeacherRazorpayAccountId(teacherId) {
  const [teacherSnap, profileSnap, userSnap] = await Promise.all([
    db.ref(`teachers/${teacherId}/razorpay_account_id`).get(),
    db.ref(`profiles/${teacherId}/razorpay_account_id`).get(),
    db.ref(`users/${teacherId}/razorpay_account_id`).get(),
  ]);

  return teacherSnap.val() || profileSnap.val() || userSnap.val() || null;
}

export async function createPaymentRecord(paymentId, data) {
  await db.ref(`payments/${paymentId}`).set({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function updatePaymentRecord(paymentId, data) {
  await db.ref(`payments/${paymentId}`).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function findPaymentByOrderId(orderId) {
  const snapshot = await db.ref('payments').orderByChild('order_id').equalTo(orderId).get();
  if (!snapshot.exists()) return null;

  const value = snapshot.val();
  const [id, payment] = Object.entries(value)[0];
  return { id, ...payment };
}

export async function findPaymentByRazorpayPaymentId(paymentId) {
  const snapshot = await db.ref('payments').orderByChild('payment_id').equalTo(paymentId).get();
  if (!snapshot.exists()) return null;

  const value = snapshot.val();
  const [id, payment] = Object.entries(value)[0];
  return { id, ...payment };
}

export async function findPaymentBySubscriptionId(subscriptionId) {
  const snapshot = await db.ref('payments').orderByChild('subscription_id').equalTo(subscriptionId).get();
  if (!snapshot.exists()) return null;

  const value = snapshot.val();
  const [id, payment] = Object.entries(value)[0];
  return { id, ...payment };
}

export async function grantCourseAccess({ userId, courseId, course, payment }) {
  await db.ref(`enrollments/${courseId}/${userId}`).set({
    courseId,
    courseTitle: course?.title || payment?.course_title || '',
    creatorId: course?.userId || course?.teacher_id || payment?.teacher_id || '',
    amount: payment?.amount ? payment.amount / 100 : course?.price || 0,
    currency: 'INR',
    status: 'active',
    paymentProvider: 'razorpay',
    paymentMode: 'verified_checkout',
    paymentId: payment?.payment_id || '',
    orderId: payment?.order_id || '',
    enrolledAt: new Date().toISOString(),
  });
}

export async function activateEdgeSubscription({ userId, billingCycle, subscriptionId, paymentId }) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

  await db.ref(`profiles/${userId}/subscription`).set({
    planId: 'edge',
    billingCycle,
    status: 'active',
    subscribedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    razorpaySubscriptionId: subscriptionId,
    razorpayPaymentId: paymentId || '',
    lastNotifiedDaysRemaining: 999,
  });
}
