import express from 'express';
import { sessionControllerV2 } from '../controllers/sessionV2.controller.js';
import {
  authMiddleware,
  operatorMiddleware,
} from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/available/:locationId', sessionControllerV2.getAvailableSlots);
router.post('/generate-entry-qr', sessionControllerV2.generateEntryQR);
router.post(
  '/generate-gate-qr',
  authMiddleware,
  operatorMiddleware,
  sessionControllerV2.generateGateQR
);

// Protected routes
router.post('/start', authMiddleware, sessionControllerV2.startSessionWithQR);
router.post(
  '/gate-scan',
  authMiddleware,
  sessionControllerV2.startSessionFromGateQR
);
router.post(
  '/exit-gate-scan',
  authMiddleware,
  sessionControllerV2.scanExitGateQR
);
router.post('/end', authMiddleware, sessionControllerV2.endSessionWithQR);
router.post(
  '/confirm-payment',
  authMiddleware,
  sessionControllerV2.confirmPayment
);
router.delete(
  '/active/all',
  sessionControllerV2.deleteAllActiveSessions
);
router.get(
  '/history/:userId',
  authMiddleware,
  sessionControllerV2.getParkingHistory
);
router.get(
  '/:sessionId',
  authMiddleware,
  sessionControllerV2.getSessionDetails
);

export default router;
