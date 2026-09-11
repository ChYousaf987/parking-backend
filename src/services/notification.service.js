import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

const defaultServiceAccountPath = fileURLToPath(
  new URL(
    '../config/spotco-parking-firebase-adminsdk-fbsvc-a1d7446ae0.json',
    import.meta.url
  )
);

const getFirebaseApp = () => {
  if (getApps().length) return getApps()[0];

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service-account file was not found at: ${serviceAccountPath}`
    );
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  return initializeApp({ credential: cert(serviceAccount) });
};

const invalidTokenCodes = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const toStringData = (data = {}) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
  );

export const notificationService = {
  // Persist an in-app notification (always), then try FCM push.
  // Must never make a parking or payment operation fail.
  sendToUser: async (userId, { title, body, data = {} }) => {
    const stringData = toStringData(data);
    const type = stringData.type || 'general';

    let saved = null;
    try {
      saved = await Notification.create({
        userId,
        title,
        body,
        data: stringData,
        type,
      });
    } catch (error) {
      console.error('Failed to store notification:', error.message);
    }

    try {
      const user = await User.findById(userId).select('fcmTokens');
      const tokens = [...new Set((user?.fcmTokens || []).filter(Boolean))];

      if (!tokens.length) {
        return {
          sent: 0,
          stored: Boolean(saved),
          notificationId: saved?._id,
          reason: 'No FCM token registered for this user',
        };
      }

      const messaging = getMessaging(getFirebaseApp());
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
      });

      const invalidTokens = response.responses
        .map((result, index) => ({ result, token: tokens[index] }))
        .filter(({ result }) => invalidTokenCodes.has(result.error?.code))
        .map(({ token }) => token);

      if (invalidTokens.length) {
        await User.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: { $in: invalidTokens } },
        });
      }

      return {
        sent: response.successCount,
        failed: response.failureCount,
        removedInvalidTokens: invalidTokens.length,
        stored: Boolean(saved),
        notificationId: saved?._id,
      };
    } catch (error) {
      console.error('FCM notification failed:', error.message);
      return {
        sent: 0,
        failed: true,
        error: error.message,
        stored: Boolean(saved),
        notificationId: saved?._id,
      };
    }
  },
};
