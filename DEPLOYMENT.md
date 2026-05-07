# EduNook Next.js Deployment Checklist

## 1. Environment

Copy `.env.example` to `.env` locally and add real values for Firebase, Cloudinary, Resend, and Razorpay.

For Vercel, add the same values in Project Settings > Environment Variables. Use `NEXT_PUBLIC_*` values for browser-visible configuration and keep server secrets unprefixed.

Required frontend values:

- `NEXT_PUBLIC_FRONTEND_URL`
- `NEXT_PUBLIC_PAYMENT_API_BASE_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

Required server values:

- `FIREBASE_SERVICE_ACCOUNT`
- `RESEND_API_KEY`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_EDGE_MONTHLY_PLAN_ID`
- `RAZORPAY_EDGE_YEARLY_PLAN_ID`
- `RAZORPAY_PLATFORM_ACCOUNT_ID` if the platform commission should be transferred to a linked platform account. If omitted, the platform share remains in the main Razorpay balance.

Teachers must add their Razorpay linked account ID in Settings before publishing paid courses.

## 2. Firebase

Deploy Realtime Database rules:

```bash
npm run deploy:firebase:rules
```

The rules keep public profile/course/test content readable, while private user data, settings, OTPs, feedback, teacher payout settings, and payment records are restricted.

## 3. Payment API

Run the Razorpay Express backend locally:

```bash
npm run api:dev
```

Deploy the backend as a Node service and set `NEXT_PUBLIC_PAYMENT_API_BASE_URL` to that public backend URL.

Razorpay webhook URL:

```text
https://YOUR_PAYMENT_API_DOMAIN/webhook
```

Enable at least these Razorpay events:

- `payment.captured`
- `payment.failed`

## 4. Next.js Frontend

Run locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the production build:

```bash
npm run start
```

Deploy to Vercel by importing this repository and selecting the default Next.js framework preset. The production build command is `npm run build`; the output is handled by Vercel.

The old Vite commands are still available for rollback checks:

```bash
npm run vite:dev
npm run vite:build
npm run vite:preview
```

Before production, run:

```bash
npm run lint
npm run typecheck
npm run build
```

## 5. Smoke Test

After deployment, verify:

- Signup OTP sends and verifies.
- Login, logout, forgot password, and password change work.
- Free course enrollment works.
- Paid course checkout creates a Razorpay order and grants access after verification.
- Edge subscription checkout activates the profile subscription.
- Course creation blocks paid publishing until a teacher payout account is configured.
- Chat text/media send works; unsupported files are rejected.
- Tests can be created, started, submitted, and viewed on the leaderboard.
- `/sitemap.xml` and `/robots.txt` are reachable.
