import { Router } from 'express';
import {
  createCourseOrder,
  createEdgeSubscription,
  verifyCoursePayment,
  verifyEdgeSubscription,
} from '../controllers/paymentController.js';
import { authenticateFirebaseUser, requireMatchingUser } from '../middleware/auth.js';

export const paymentRouter = Router();

paymentRouter.use(authenticateFirebaseUser);
paymentRouter.use(requireMatchingUser);

paymentRouter.post('/create-order', createCourseOrder);
paymentRouter.post('/verify-payment', verifyCoursePayment);
paymentRouter.post('/create-subscription', createEdgeSubscription);
paymentRouter.post('/verify-subscription', verifyEdgeSubscription);
