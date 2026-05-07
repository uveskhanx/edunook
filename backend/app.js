import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { webhookRouter } from './routes/webhookRoutes.js';

export const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
}));

app.use(webhookRouter);
app.use(express.json({ limit: '1mb' }));
app.use(paymentRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'edunook-payments' });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _unusedNext) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    console.error(error);
  }
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
});
