import express from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.get('/users', authMiddleware, adminMiddleware, authController.getAllUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, authController.deleteUser);

export default router;
