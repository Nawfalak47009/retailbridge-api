import { Injectable, Logger } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
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
   * Save or update Expo Push Token for a user
   */
  async savePushToken(userId: string, pushToken: string): Promise<{ success: boolean; message: string }> {
    if (!userId || !pushToken) {
      return { success: false, message: "Missing userId or pushToken" };
    }

    try {
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
   * Send push notification to a single user by userId
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

      return await this.sendPushMessage(user.pushToken, payload);
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

      const tokens = userRecords
        .map((u) => u.pushToken)
        .filter((t): t is string => Boolean(t && (t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"))));

      if (tokens.length === 0) return;

      await this.sendPushBatch(tokens, payload);
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
