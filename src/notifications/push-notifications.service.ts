import { Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export interface PushNotificationPayload {
  title: string;
  body: string;
  screenToOpen?: string;
  data?: Record<string, any>;
  channelId?: string;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly expoPushUrl = "https://exp.host/--/api/v2/push/send";

  /**
   * Save or update Expo Push Token for a user.
   * Ensures the token is cleared from any prior user on this device so
   * notifications are strictly bound to the authenticated user.
   */
  async savePushToken(userId: string, pushToken?: string | null): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      return { success: false, message: "Missing userId" };
    }

    try {
      if (!pushToken) {
        await db
          .update(users)
          .set({ pushToken: null })
          .where(eq(users.id, userId));

        this.logger.log(`Cleared pushToken for user ${userId}`);
        return { success: true, message: "Push token cleared" };
      }

      // Unbind this push token from any other accounts on this phone
      await db
        .update(users)
        .set({ pushToken: null })
        .where(and(eq(users.pushToken, pushToken), ne(users.id, userId)));

      await db
        .update(users)
        .set({ pushToken })
        .where(eq(users.id, userId));

      this.logger.log(`Updated pushToken for user ${userId}: ${pushToken.slice(0, 25)}...`);
      return { success: true, message: "Push token registered successfully" };
    } catch (err) {
      this.logger.error(`Failed to save pushToken for user ${userId}`, err);
      return { success: false, message: "Failed to save push token" };
    }
  }

  /**
   * Send push notification to a single user by userId, stamped with authentication identifiers
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!userId) return false;

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user || !user.pushToken) {
        this.logger.debug(`User ${userId} has no registered pushToken. Skipping remote push.`);
        return false;
      }

      const enrichedPayload: PushNotificationPayload = {
        ...payload,
        data: {
          recipientId: userId,
          recipientRole: user.role,
          screenToOpen: payload.screenToOpen || "",
          ...(payload.data || {}),
        },
      };

      return await this.sendPushMessage(user.pushToken, enrichedPayload);
    } catch (err) {
      this.logger.error(`Error sending push to user ${userId}:`, err);
      return false;
    }
  }

  /**
   * Send push notification to multiple users by userIds
   */
  async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    if (!userIds || userIds.length === 0) return;

    try {
      const userRecords = await db.query.users.findMany({
        where: inArray(users.id, userIds),
      });

      for (const u of userRecords) {
        if (u.pushToken && (u.pushToken.startsWith("ExponentPushToken") || u.pushToken.startsWith("ExpoPushToken"))) {
          const enrichedPayload: PushNotificationPayload = {
            ...payload,
            data: {
              recipientId: u.id,
              recipientRole: u.role,
              screenToOpen: payload.screenToOpen || "",
              ...(payload.data || {}),
            },
          };
          await this.sendPushMessage(u.pushToken, enrichedPayload);
        }
      }
    } catch (err) {
      this.logger.error(`Error sending push to users:`, err);
    }
  }

  /**
   * Dispatch push message to Expo Push Service
   */
  private async sendPushMessage(token: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!token || (!token.startsWith("ExponentPushToken") && !token.startsWith("ExpoPushToken"))) {
      this.logger.warn(`Invalid Expo push token format: ${token}`);
      return false;
    }

    const message = {
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      channelId: payload.channelId || "orders",
      priority: "high",
      _displayInForeground: true,
      data: {
        screenToOpen: payload.screenToOpen || "",
        ...(payload.data || {}),
      },
    };

    try {
      const response = await fetch(this.expoPushUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      const resData = await response.json();
      this.logger.log(`Expo push sent: ${JSON.stringify(resData)}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to dispatch push notification via Expo API:`, err);
      return false;
    }
  }

  /**
   * Dispatch batch push messages to Expo Push Service
   */
  private async sendPushBatch(tokens: string[], payload: PushNotificationPayload): Promise<void> {
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      channelId: payload.channelId || "orders",
      priority: "high",
      _displayInForeground: true,
      data: {
        screenToOpen: payload.screenToOpen || "",
        ...(payload.data || {}),
      },
    }));

    try {
      const response = await fetch(this.expoPushUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const resData = await response.json();
      this.logger.log(`Expo push batch response: ${JSON.stringify(resData)}`);
    } catch (err) {
      this.logger.error(`Failed to dispatch batch push notifications via Expo API:`, err);
    }
  }
}
