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
};
