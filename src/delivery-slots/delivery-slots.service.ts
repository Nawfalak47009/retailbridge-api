import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  eq,
  and,
  inArray,
} from "drizzle-orm";

import { db } from "../db";

import {
  deliverySlots,
  agencyShopConnections,
  agencies,
  shops,
  orders,
} from "../db/schema";

import {
  CreateDeliverySlotDto,
} from "./dto/create-delivery-slot.dto";
import { calculateNextDeliveryDate } from "./delivery-slots.utils";
import { PushNotificationsService } from "../notifications/push-notifications.service";

@Injectable()
export class DeliverySlotsService {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}
  // ==========================================
  // CREATE DELIVERY DAY
  // AGENCY ONLY
  // ==========================================

  async create(
    dto: CreateDeliverySlotDto,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can create delivery days.",
      );
    }

    // ------------------------------------------
    // Verify agency
    // ------------------------------------------

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          dto.agencyId,
        ),
      });

    if (!agency) {
      throw new BadRequestException(
        "Agency not found.",
      );
    }

    if (agency.userId !== user.id) {
      throw new ForbiddenException(
        "You can only create delivery days for your own agency.",
      );
    }

    // ------------------------------------------
    // Verify shop is connected
    // ------------------------------------------

    const connection =
      await db.query.agencyShopConnections.findFirst({
        where: and(
          eq(
            agencyShopConnections.agencyId,
            dto.agencyId,
          ),
          eq(
            agencyShopConnections.shopId,
            dto.shopId,
          ),
        ),
      });

    if (!connection) {
      throw new ForbiddenException(
        "This shop is not connected to your agency.",
      );
    }

    // ------------------------------------------
    // Validate delivery date
    // ------------------------------------------

    const deliveryDate =
      new Date(dto.deliveryDate);

    if (
      Number.isNaN(
        deliveryDate.getTime(),
      )
    ) {
      throw new BadRequestException(
        "Invalid delivery date.",
      );
    }

    // Normalize to midnight
    deliveryDate.setHours(
      0,
      0,
      0,
      0,
    );

    // ------------------------------------------
    // Automatically derive weekday
    // ------------------------------------------

    const day =
      deliveryDate.toLocaleDateString(
        "en-US",
        {
          weekday: "long",
        },
      );

    // ------------------------------------------
    // Check duplicate delivery day
    //
    // Same agency + same shop +
    // same delivery date = duplicate
    // ------------------------------------------

    const existingDeliveryDay =
      await db.query.deliverySlots.findFirst({
        where: and(
          eq(
            deliverySlots.agencyId,
            dto.agencyId,
          ),
          eq(
            deliverySlots.shopId,
            dto.shopId,
          ),
          eq(
            deliverySlots.deliveryDate,
            deliveryDate,
          ),
        ),
      });

    if (existingDeliveryDay) {
      throw new BadRequestException(
        "This delivery day already exists for this shop.",
      );
    }

    // ------------------------------------------
    // Create delivery day
    // ------------------------------------------

    const [deliveryDay] =
      await db
        .insert(deliverySlots)
        .values({
          agencyId:
            dto.agencyId,

          shopId:
            dto.shopId,

          day,

          deliveryDate,

          isActive:
            "true",
        })
        .returning();

    // Immediately sync all pending/active orders for this shop to this delivery date
    try {
      await db
        .update(orders)
        .set({
          scheduledDate: deliveryDate,
          slotId: deliveryDay.id,
          status: "SCHEDULED",
        })
        .where(
          and(
            eq(orders.agencyId, dto.agencyId),
            eq(orders.shopId, dto.shopId),
            inArray(orders.status, [
              "DELIVERY_SCHEDULE_PENDING",
              "PLACED",
              "ACCEPTED",
              "PROCESSING",
              "PENDING",
              "SCHEDULED",
            ]),
          ),
        );
    } catch (orderSyncErr) {
      console.log("Order delivery slot sync note:", orderSyncErr);
    }

    // ==========================================
    // NOTIFY GROCERY USER VIA PUSH (even when app is closed / mobile is locked)
    // ==========================================
    try {
      const shop = await db.query.shops.findFirst({
        where: eq(shops.id, dto.shopId),
      });

      if (shop?.userId) {
        const formattedDate = deliveryDate.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        await this.pushNotificationsService.sendToUser(shop.userId, {
          title: "📅 Delivery Day Scheduled!",
          body: `${agency.agencyName || "Agency"} scheduled your delivery for ${day} (${formattedDate}).`,
          screenToOpen: "/(grocery)/orders",
          channelId: "orders",
          data: {
            agencyId: agency.id,
            shopId: shop.id,
            day,
            deliveryDate: deliveryDate.toISOString(),
          },
        });
      }
    } catch (pushErr) {
      console.log("Error dispatching delivery slot push notification:", pushErr);
    }

    return {
      success: true,

      message:
        "Delivery day created successfully.",

      slot: deliveryDay,
    };
  }

  // ==========================================
  // AGENCY → ALL MY DELIVERY DAYS
  // ==========================================

  async findByAgency(
    agencyId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access agency delivery days.",
      );
    }

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          agencyId,
        ),
      });

    if (
      !agency ||
      agency.userId !== user.id
    ) {
      throw new ForbiddenException(
        "You can only access your own agency delivery days.",
      );
    }

    const slots = await db
      .select()
      .from(deliverySlots)
      .where(
        eq(
          deliverySlots.agencyId,
          agencyId,
        ),
      );

    return Promise.all(
      slots.map(async (slot) => {
        const nextDate = calculateNextDeliveryDate(slot, new Date());
        const shop = await db.query.shops.findFirst({
          where: eq(shops.id, slot.shopId),
        });

        return {
          ...slot,
          deliveryDate: nextDate,
          shop: shop
            ? {
                id: shop.id,
                shopName: shop.shopName,
                ownerName: shop.ownerName,
                phone: shop.phone,
                address: shop.address,
                pincode: shop.pincode,
              }
            : null,
        };
      }),
    );
  }

  // ==========================================
  // AGENCY → ONE SHOP'S DELIVERY DAYS
  // ==========================================

  async findByAgencyShop(
    agencyId: string,
    shopId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access agency delivery days.",
      );
    }

    // ------------------------------------------
    // Verify agency
    // ------------------------------------------

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          agencyId,
        ),
      });

    if (
      !agency ||
      agency.userId !== user.id
    ) {
      throw new ForbiddenException(
        "You can only access your own agency delivery days.",
      );
    }

    // ------------------------------------------
    // Verify shop connection
    // ------------------------------------------

    const connection =
      await db.query.agencyShopConnections.findFirst({
        where: and(
          eq(
            agencyShopConnections.agencyId,
            agencyId,
          ),
          eq(
            agencyShopConnections.shopId,
            shopId,
          ),
        ),
      });

    if (!connection) {
      throw new ForbiddenException(
        "This shop is not connected to your agency.",
      );
    }

    // ------------------------------------------
    // Return delivery days
    // ------------------------------------------

    const slots = await db
      .select()
      .from(deliverySlots)
      .where(
        and(
          eq(
            deliverySlots.agencyId,
            agencyId,
          ),
          eq(
            deliverySlots.shopId,
            shopId,
          ),
        ),
      );

    return slots.map((slot) => {
      const nextDate = calculateNextDeliveryDate(slot, new Date());
      return {
        ...slot,
        deliveryDate: nextDate,
      };
    });
  }

  // ==========================================
  // SHOP → CONNECTED AGENCY DELIVERY DAYS
  // ==========================================

  async findByShop(
    shopId: string,
    user: any,
  ) {
    if (user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access shop delivery days.",
      );
    }

    // ------------------------------------------
    // Get connected agencies
    // ------------------------------------------

    const connections =
      await db
        .select({
          agencyId:
            agencyShopConnections.agencyId,
        })
        .from(agencyShopConnections)
        .where(
          eq(
            agencyShopConnections.shopId,
            shopId,
          ),
        );

    const agencyIds =
      connections.map(
        (connection) =>
          connection.agencyId,
      );

    if (
      agencyIds.length === 0
    ) {
      return [];
    }

    // ------------------------------------------
    // Return active delivery days
    // ------------------------------------------

    const activeSlots = await db
      .select()
      .from(deliverySlots)
      .where(
        and(
          inArray(
            deliverySlots.agencyId,
            agencyIds,
          ),
          eq(
            deliverySlots.shopId,
            shopId,
          ),
          eq(
            deliverySlots.isActive,
            "true",
          ),
        ),
      );

    return activeSlots.map((slot) => {
      const nextDate = calculateNextDeliveryDate(slot, new Date());
      return {
        ...slot,
        deliveryDate: nextDate,
      };
    });
  }

  // ==========================================
  // DELETE DELIVERY DAY
  // AGENCY ONLY
  // ==========================================

  async remove(
    id: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can delete delivery days.",
      );
    }

    const deliveryDay =
      await db.query.deliverySlots.findFirst({
        where: eq(
          deliverySlots.id,
          id,
        ),
      });

    if (!deliveryDay) {
      throw new BadRequestException(
        "Delivery day not found.",
      );
    }

    // ------------------------------------------
    // Verify agency ownership
    // ------------------------------------------

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          deliveryDay.agencyId,
        ),
      });

    if (
      !agency ||
      agency.userId !== user.id
    ) {
      throw new ForbiddenException(
        "You can only delete your own agency delivery days.",
      );
    }

    // ------------------------------------------
    // Delete
    // ------------------------------------------

    await db
      .delete(deliverySlots)
      .where(
        eq(
          deliverySlots.id,
          id,
        ),
      );

    return {
      success: true,

      message:
        "Delivery day deleted successfully.",
    };
  }

  // ==========================================
  // SHOP → ACTIVE SLOT ORDERING REMINDERS
  // ==========================================

  async getShopSlotReminders(
    shopId: string,
    user?: any,
  ) {
    if (user && user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access slot reminders.",
      );
    }

    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId),
    });

    // ------------------------------------------
    // Get connected agencies
    // ------------------------------------------

    const connections = await db
      .select({
        agencyId: agencyShopConnections.agencyId,
      })
      .from(agencyShopConnections)
      .where(eq(agencyShopConnections.shopId, shopId));

    const agencyIds = connections.map((c) => c.agencyId);
    if (agencyIds.length === 0) {
      return [];
    }

    // ------------------------------------------
    // Find active future/today delivery slots
    // ------------------------------------------
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSlots = await db
      .select()
      .from(deliverySlots)
      .where(
        and(
          inArray(deliverySlots.agencyId, agencyIds),
          eq(deliverySlots.shopId, shopId),
          eq(deliverySlots.isActive, "true"),
        ),
      );

    // Project slots for today or upcoming (next future delivery date)
    const upcomingSlots = activeSlots.map((slot) => {
      const nextDate = calculateNextDeliveryDate(slot, today);
      return {
        ...slot,
        deliveryDate: nextDate,
      };
    });

    if (upcomingSlots.length === 0) {
      return [];
    }

    // ------------------------------------------
    // Get shop orders to check if order already placed
    // ------------------------------------------
    const shopOrders = await db.query.orders.findMany({
      where: eq(orders.shopId, shopId),
    });

    // ------------------------------------------
    // Map reminders
    // ------------------------------------------
    const reminders: any[] = [];

    for (const slot of upcomingSlots) {
      const agency = await db.query.agencies.findFirst({
        where: eq(agencies.id, slot.agencyId),
      });

      const slotDate = new Date(slot.deliveryDate);
      const slotDateEnd = new Date(slot.deliveryDate);
      slotDateEnd.setHours(23, 59, 59, 999);

      // Check if there is an active order placed for this agency & delivery slot
      const existingOrder = shopOrders.find((ord) => {
        if (ord.agencyId !== slot.agencyId) return false;
        if (ord.status === "CANCELLED") return false;

        // Any active, non-delivered order means the shop has already ordered!
        if (
          ord.status === "DELIVERY_SCHEDULE_PENDING" ||
          ord.status === "PENDING" ||
          ord.status === "ACCEPTED" ||
          ord.status === "SCHEDULED" ||
          ord.status === "OUT_FOR_DELIVERY" ||
          ord.status === "PROCESSING" ||
          ord.status === "PLACED"
        ) {
          return true;
        }

        // Matches slotId
        if (ord.slotId && ord.slotId === slot.id) return true;

        // Matches scheduledDate on the same day
        if (ord.scheduledDate) {
          const ordSched = new Date(ord.scheduledDate);
          if (
            ordSched.getFullYear() === slotDate.getFullYear() &&
            ordSched.getMonth() === slotDate.getMonth() &&
            ordSched.getDate() === slotDate.getDate()
          ) {
            return true;
          }
        }

        return false;
      });

      // If already ordered, don't show pending order reminder
      if (existingOrder) {
        continue;
      }

      // Calculate time remaining until cutoff
      const now = new Date();
      const diffMs = slotDateEnd.getTime() - now.getTime();
      const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
      const isUrgent = diffHours <= 36; // Within 1.5 days

      const formattedDate = slotDate.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const tamilMessage = `🔔 *RetailBridge டெலிவரி நினைவூட்டல்* 🔔\n\nவணக்கம் *${shop?.shopName || "கடை உரிமையாளர்"}*,\n\n🏢 உங்கள் இணைக்கப்பட்ட ஏஜென்சி: *${agency?.agencyName || "ஏஜென்சி"}*\n🚚 டெலிவரி நாள்: *${slot.day}* (${formattedDate})\n\n⚠️ *தயவுசெய்து உங்கள் ஸ்லாட் முடிவடைவதற்குள் தேவையான பொருட்களை உடனே ஆர்டர் செய்யவும்!*\n(Please order your products before your slot closes)\n\nஸ்லாட் நேரம் முடிந்தவுடன் இந்த வாரத்திற்கான ஆர்டர்கள் ஏற்றுக்கொள்ளப்படாது. உடனடியாக ஆர்டர் செய்ய RetailBridge செயலியைப் பயன்படுத்தவும்.\n\nநன்றி! 🙏\nRetailBridge Support`;

      reminders.push({
        slotId: slot.id,
        agencyId: slot.agencyId,
        agencyName: agency?.agencyName || "Connected Agency",
        agencyPhone: agency?.phone || "",
        ownerName: agency?.ownerName || "",
        shopId,
        shopName: shop?.shopName || "Grocery Store",
        shopPhone: shop?.phone || "",
        deliveryDate: slot.deliveryDate,
        day: slot.day,
        formattedDate,
        isUrgent,
        hoursLeft: diffHours,
        message: `Agency ${agency?.agencyName || "Wholesaler"} has scheduled delivery for ${slot.day} (${formattedDate}). Please place your grocery order before the slot closes!`,
        tamilMessage,
      });
    }

    return reminders;
  }

  // ==========================================
  // TAMIL WHATSAPP SLOT REMINDER GENERATION
  // ==========================================

  async getWhatsAppSlotReminder(shopId: string, slotId: string) {
    const shop = await db.query.shops.findFirst({
      where: eq(shops.id, shopId),
    });
    const slot = await db.query.deliverySlots.findFirst({
      where: eq(deliverySlots.id, slotId),
    });
    if (!slot) {
      throw new BadRequestException("Delivery slot not found");
    }
    const agency = await db.query.agencies.findFirst({
      where: eq(agencies.id, slot.agencyId),
    });

    const slotDate = new Date(slot.deliveryDate);
    const formattedDate = slotDate.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const tamilMessage = `🔔 *RetailBridge டெலிவரி நினைவூட்டல்* 🔔\n\nவணக்கம் *${shop?.shopName || "கடை உரிமையாளர்"}*,\n\n🏢 உங்கள் இணைக்கப்பட்ட ஏஜென்சி: *${agency?.agencyName || "ஏஜென்சி"}*\n🚚 டெலிவரி நாள்: *${slot.day}* (${formattedDate})\n\n⚠️ *தயவுசெய்து உங்கள் ஸ்லாட் முடிவடைவதற்குள் தேவையான பொருட்களை உடனே ஆர்டர் செய்யவும்!*\n(Please order your products before your slot closes)\n\nஸ்லாட் நேரம் முடிந்தவுடன் இந்த வாரத்திற்கான ஆர்டர்கள் ஏற்றுக்கொள்ளப்படாது. உடனடியாக ஆர்டர் செய்ய RetailBridge செயலியைப் பயன்படுத்தவும்.\n\nநன்றி! 🙏\nRetailBridge Support`;

    const cleanPhone = (shop?.phone || "").replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    return {
      success: true,
      shopPhone: shop?.phone || "",
      formattedPhone,
      shopName: shop?.shopName || "Grocery Store",
      agencyName: agency?.agencyName || "Agency",
      day: slot.day,
      formattedDate,
      tamilMessage,
      whatsappUrl: `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(tamilMessage)}`,
    };
  }
}