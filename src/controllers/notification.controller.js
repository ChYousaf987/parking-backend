import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

export const notificationController = {
  registerToken: async (req, res) => {
    try {
      const { fcmToken } = req.body;
      if (!fcmToken || typeof fcmToken !== 'string') {
        return res.status(400).json({ message: 'A valid fcmToken is required' });
      }

      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { fcmTokens: fcmToken.trim() },
      });

      res.status(200).json({ message: 'Notification token registered' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  removeToken: async (req, res) => {
    try {
      const { fcmToken } = req.body;
      if (!fcmToken || typeof fcmToken !== 'string') {
        return res.status(400).json({ message: 'A valid fcmToken is required' });
      }

      await User.findByIdAndUpdate(req.user._id, {
        $pull: { fcmTokens: fcmToken.trim() },
      });

      res.status(200).json({ message: 'Notification token removed' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // GET /api/notifications — inbox for the logged-in user
  getMyNotifications: async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

      const filter = { userId: req.user._id };
      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, isRead: false }),
      ]);

      res.status(200).json({
        notifications,
        unreadCount,
        pagination: {
          total,
          limit,
          skip,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // PATCH /api/notifications/:id/read
  markAsRead: async (req, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { $set: { isRead: true } },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      res.status(200).json({
        message: 'Notification marked as read',
        notification,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // PATCH /api/notifications/read-all
  markAllAsRead: async (req, res) => {
    try {
      const result = await Notification.updateMany(
        { userId: req.user._id, isRead: false },
        { $set: { isRead: true } }
      );

      res.status(200).json({
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};
