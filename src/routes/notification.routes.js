import express from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.put('/token', authMiddleware, notificationController.registerToken);
router.delete('/token', authMiddleware, notificationController.removeToken);

router.get('/', authMiddleware, notificationController.getMyNotifications);
router.patch(
  '/read-all',
  authMiddleware,
  notificationController.markAllAsRead
);
router.patch(
  '/:id/read',
  authMiddleware,
  notificationController.markAsRead
);

export default router;
