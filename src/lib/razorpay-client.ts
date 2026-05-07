import { auth } from '@/lib/firebase';
import { publicEnv } from '@/lib/public-env';

type RazorpayInstance = { open: () => void };

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpaySubscriptionResponse {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  subscription_id?: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayPaymentResponse & RazorpaySubscriptionResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const PAYMENT_API_BASE_URL = publicEnv.paymentApiBaseUrl;

export type CourseOrderResponse = {
  order_id: string;
  amount: number;
  currency: 'INR';
  key_id: string;
};

export type EdgeSubscriptionResponse = {
  subscription_id: string;
  key_id: string;
  plan: 'edge';
  billing_cycle: 'monthly' | 'yearly';
};

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Please sign in before starting payment.');
  }

  const response = await fetch(`${PAYMENT_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Payment request failed';
    throw new Error(message);
  }
  return payload as T;
}

export function loadRazorpayCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function createCourseOrder(courseId: string, userId: string) {
  return apiPost<CourseOrderResponse>('/create-order', {
    course_id: courseId,
    user_id: userId,
  });
}

export function verifyCoursePayment(payload: {
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiPost<{ success: boolean; status: string }>('/verify-payment', payload);
}

export function createEdgeSubscription(userId: string, billingCycle: 'monthly' | 'yearly') {
  return apiPost<EdgeSubscriptionResponse>('/create-subscription', {
    user_id: userId,
    billing_cycle: billingCycle,
  });
}

export function verifyEdgeSubscription(payload: {
  user_id: string;
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiPost<{ success: boolean; status: string }>('/verify-subscription', payload);
}
