import express from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/stats', authMiddleware, dashboardController.getDashboardStats);
router.get(
  '/sessions',
  authMiddleware,
  dashboardController.getDashboardSessions
);
router.get('/revenue', authMiddleware, dashboardController.getDailyRevenue);
router.get('/analytics', authMiddleware, dashboardController.getAnalytics);

export default router;
