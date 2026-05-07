import { env } from '../config/env.js';
import { razorpay } from '../config/razorpay.js';
import {
  activateEdgeSubscription,
  createPaymentRecord,
  findPaymentByOrderId,
  findPaymentBySubscriptionId,
  getCourseForPayment,
  getTeacherRazorpayAccountId,
  grantCourseAccess,
  splitCourseAmount,
  toPaise,
  updatePaymentRecord,
} from '../services/paymentService.js';
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
} from '../utils/crypto.js';

function assertString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

export async function createCourseOrder(req, res, next) {
  try {
    const courseId = assertString(req.body.course_id, 'course_id');
    const userId = assertString(req.body.user_id, 'user_id');

    const course = await getCourseForPayment(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const teacherId = course.teacher_id || course.userId;
    if (!teacherId) return res.status(422).json({ error: 'Course teacher is missing' });

    const amount = toPaise(course.price);
    if (amount <= 0) return res.status(400).json({ error: 'Course is free and does not need payment' });

    const teacherAccountId = await getTeacherRazorpayAccountId(teacherId);
    if (!teacherAccountId) {
      return res.status(422).json({ error: 'Teacher Razorpay linked account is not configured' });
    }

    const { teacherAmount, platformAmount } = splitCourseAmount(amount);
    const transfers = [
      {
        account: teacherAccountId,
        amount: teacherAmount,
        currency: 'INR',
        notes: {
          split: 'teacher_65',
          course_id: courseId,
          teacher_id: teacherId,
        },
      },
    ];

    if (env.razorpayPlatformAccountId) {
      transfers.push({
        account: env.razorpayPlatformAccountId,
        amount: platformAmount,
        currency: 'INR',
        notes: {
          split: 'platform_35',
          course_id: courseId,
        },
      });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `course_${courseId}_${Date.now()}`.slice(0, 40),
      payment_capture: 1,
      notes: {
        course_id: courseId,
        user_id: userId,
        teacher_id: teacherId,
        platform_commission_percent: '35',
        teacher_commission_percent: '65',
      },
      transfers,
    });

    await createPaymentRecord(order.id, {
      id: order.id,
      user_id: userId,
      course_id: courseId,
      course_title: course.title || '',
      teacher_id: teacherId,
      teacher_razorpay_account_id: teacherAccountId,
      order_id: order.id,
      payment_id: '',
      amount,
      currency: 'INR',
      status: 'created',
      type: 'course',
      teacher_amount: teacherAmount,
      platform_amount: platformAmount,
      split_mode: env.razorpayPlatformAccountId ? 'teacher_and_platform_transfers' : 'teacher_transfer_platform_balance',
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: env.razorpayKeyId,
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyCoursePayment(req, res, next) {
  try {
    const orderId = assertString(req.body.razorpay_order_id, 'razorpay_order_id');
    const paymentId = assertString(req.body.razorpay_payment_id, 'razorpay_payment_id');
    const signature = assertString(req.body.razorpay_signature, 'razorpay_signature');

    const valid = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature,
      secret: env.razorpayKeySecret,
    });
    if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });

    const paymentRecord = await findPaymentByOrderId(orderId);
    if (!paymentRecord) return res.status(404).json({ error: 'Payment record not found' });
    if (paymentRecord.user_id !== req.body.user_id) {
      return res.status(403).json({ error: 'Payment does not belong to the authenticated user' });
    }

    const course = await getCourseForPayment(paymentRecord.course_id);
    await updatePaymentRecord(paymentRecord.id, {
      payment_id: paymentId,
      signature,
      status: 'success',
      verifiedAt: new Date().toISOString(),
    });

    await grantCourseAccess({
      userId: paymentRecord.user_id,
      courseId: paymentRecord.course_id,
      course,
      payment: { ...paymentRecord, payment_id: paymentId },
    });

    return res.json({ success: true, status: 'success' });
  } catch (error) {
    return next(error);
  }
}

export async function createEdgeSubscription(req, res, next) {
  try {
    const userId = assertString(req.body.user_id, 'user_id');
    const billingCycle = req.body.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    const planId = billingCycle === 'yearly' ? env.edgeYearlyPlanId : env.edgeMonthlyPlanId;

    if (!planId) {
      return res.status(500).json({ error: `Razorpay Edge ${billingCycle} plan id is not configured` });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: billingCycle === 'yearly' ? 5 : 60,
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: userId,
        plan: 'edge',
        billing_cycle: billingCycle,
      },
    });

    await createPaymentRecord(subscription.id, {
      id: subscription.id,
      user_id: userId,
      course_id: '',
      payment_id: '',
      subscription_id: subscription.id,
      amount: 0,
      currency: 'INR',
      status: 'created',
      type: 'edge_subscription',
      billing_cycle: billingCycle,
      split_mode: 'platform_only',
    });

    return res.json({
      subscription_id: subscription.id,
      key_id: env.razorpayKeyId,
      plan: 'edge',
      billing_cycle: billingCycle,
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyEdgeSubscription(req, res, next) {
  try {
    const subscriptionId = assertString(req.body.razorpay_subscription_id, 'razorpay_subscription_id');
    const paymentId = assertString(req.body.razorpay_payment_id, 'razorpay_payment_id');
    const signature = assertString(req.body.razorpay_signature, 'razorpay_signature');

    const valid = verifyRazorpaySubscriptionSignature({
      subscriptionId,
      paymentId,
      signature,
      secret: env.razorpayKeySecret,
    });
    if (!valid) return res.status(400).json({ error: 'Invalid subscription signature' });

    const paymentRecord = await findPaymentBySubscriptionId(subscriptionId);
    const recordId = paymentRecord?.id || subscriptionId;
    const billingCycle = paymentRecord?.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    const userId = paymentRecord?.user_id || assertString(req.body.user_id, 'user_id');
    if (userId !== req.body.user_id) {
      return res.status(403).json({ error: 'Subscription does not belong to the authenticated user' });
    }

    await updatePaymentRecord(recordId, {
      payment_id: paymentId,
      subscription_id: subscriptionId,
      signature,
      status: 'success',
      verifiedAt: new Date().toISOString(),
    });

    await activateEdgeSubscription({ userId, billingCycle, subscriptionId, paymentId });

    return res.json({ success: true, status: 'success' });
  } catch (error) {
    return next(error);
  }
}
