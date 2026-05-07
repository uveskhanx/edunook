import { Router } from 'express';
import express from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController.js';

export const webhookRouter = Router();

webhookRouter.post(
  '/webhook',
  express.raw({
    type: 'application/json',
    verify: (req, _res, buffer) => {
      req.rawBody = buffer;
    },
  }),
  handleRazorpayWebhook,
);
