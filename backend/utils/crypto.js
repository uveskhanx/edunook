import crypto from 'crypto';

export function hmacSha256(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyRazorpayPaymentSignature({ orderId, paymentId, signature, secret }) {
  const expected = hmacSha256(`${orderId}|${paymentId}`, secret);
  return timingSafeEqual(expected, signature);
}

export function verifyRazorpaySubscriptionSignature({ paymentId, subscriptionId, signature, secret }) {
  const expected = hmacSha256(`${paymentId}|${subscriptionId}`, secret);
  return timingSafeEqual(expected, signature);
}

export function verifyWebhookSignature({ rawBody, signature, secret }) {
  const expected = hmacSha256(rawBody, secret);
  return timingSafeEqual(expected, signature);
}
