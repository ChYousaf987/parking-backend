import express from 'express';
import { authControllerV2 } from '../controllers/authV2.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', authControllerV2.registerWithOTP);
router.post('/verify-otp', authControllerV2.verifyOTP);
router.post('/resend-otp', authControllerV2.resendOTP);
router.post('/login', authControllerV2.login);

// Protected routes
router.get('/profile', authMiddleware, authControllerV2.getProfile);
router.put('/profile', authMiddleware, authControllerV2.updateProfile);

export default router;
