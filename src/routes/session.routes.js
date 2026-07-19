import express from 'express';
import { sessionController } from '../controllers/session.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Session routes
router.post('/start', authMiddleware, sessionController.startSession);
router.post('/:sessionId/end', authMiddleware, sessionController.endSession);
router.get('/', sessionController.getAllSessions);
router.get('/active', sessionController.getActiveSessions);
router.get('/user/:userId', sessionController.getUserSessions);
router.get('/:sessionId', sessionController.getSessionById);

// Reservation routes
router.post('/reserve', authMiddleware, sessionController.reserveSpot);

// QR Code Scanning Routes
router.post('/qr/entry', authMiddleware, sessionController.scanQRCodeEntry);
router.post('/qr/exit', authMiddleware, sessionController.scanQRCodeExit);

export default router;
