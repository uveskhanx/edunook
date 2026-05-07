import { env } from '../config/env.js';
import {
  findPaymentByOrderId,
  findPaymentByRazorpayPaymentId,
  getCourseForPayment,
  grantCourseAccess,
  updatePaymentRecord,
} from '../services/paymentService.js';
import { verifyWebhookSignature } from '../utils/crypto.js';

export async function handleRazorpayWebhook(req, res, next) {
  try {
    const signature = req.get('X-Razorpay-Signature');
    const rawBody = req.rawBody?.toString('utf8') || '';

    const valid = verifyWebhookSignature({
      rawBody,
      signature,
      secret: env.razorpayWebhookSecret,
    });
    if (!valid) return res.status(400).json({ error: 'Invalid webhook signature' });

    const event = JSON.parse(rawBody);
    const paymentEntity = event?.payload?.payment?.entity;

    if (event.event === 'payment.captured' && paymentEntity?.id) {
      const record = await findPaymentByRazorpayPaymentId(paymentEntity.id)
        || (paymentEntity.order_id ? await findPaymentByOrderId(paymentEntity.order_id) : null);
      if (record) {
        await updatePaymentRecord(record.id, {
          status: 'success',
          payment_id: paymentEntity.id,
          webhookEvent: event.event,
          capturedAt: new Date().toISOString(),
        });

        if (record.type === 'course') {
          const course = await getCourseForPayment(record.course_id);
          await grantCourseAccess({
            userId: record.user_id,
            courseId: record.course_id,
            course,
            payment: record,
          });
        }
      }
    }

    if (event.event === 'payment.failed' && paymentEntity?.id) {
      const record = await findPaymentByRazorpayPaymentId(paymentEntity.id)
        || (paymentEntity.order_id ? await findPaymentByOrderId(paymentEntity.order_id) : null);
      if (record) {
        await updatePaymentRecord(record.id, {
          status: 'failed',
          payment_id: paymentEntity.id,
          webhookEvent: event.event,
          failureReason: paymentEntity.error_description || paymentEntity.error_reason || '',
        });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
}
