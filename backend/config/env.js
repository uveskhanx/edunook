import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  allowedOrigins: (process.env.CORS_ORIGIN || 'http://127.0.0.1:3000,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  razorpayKeyId: required('RAZORPAY_KEY_ID'),
  razorpayKeySecret: required('RAZORPAY_KEY_SECRET'),
  razorpayWebhookSecret: required('RAZORPAY_WEBHOOK_SECRET'),
  razorpayPlatformAccountId: process.env.RAZORPAY_PLATFORM_ACCOUNT_ID || '',
  edgeMonthlyPlanId: process.env.RAZORPAY_EDGE_MONTHLY_PLAN_ID || '',
  edgeYearlyPlanId: process.env.RAZORPAY_EDGE_YEARLY_PLAN_ID || '',
  firebaseDatabaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || required('VITE_FIREBASE_DATABASE_URL'),
  firebaseServiceAccount: required('FIREBASE_SERVICE_ACCOUNT'),
};
