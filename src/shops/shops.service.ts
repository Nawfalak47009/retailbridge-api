import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq, and, inArray } from "drizzle-orm";

import { db } from "../db";

import {
  shops,
  agencies,
  orders,
  orderItems,
  products,
  agencyShopConnections,
  deliverySlots,
  documents,
  users,
} from "../db/schema";

import { SubmitShopDocumentsDto } from "./dto/submit-shop-documents.dto";
import { calculateNextDeliveryDate } from "../delivery-slots/delivery-slots.utils";
import { S3Service } from "../documents/s3.service";

@Injectable()
export class ShopsService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

  // =====================================
  // Submit Documents
  // =====================================

  async submit(
    dto: SubmitShopDocumentsDto,
  ) {
    try {
      // 1. Update users table with aadhaar URL
      await db
        .update(users)
        .set({
          aadhaar: dto.aadhaar,
        })
        .where(eq(users.id, dto.userId));

      // 2. Clean previous document records for this user
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.userId, dto.userId),
            inArray(documents.documentType, ["AADHAAR", "SHOP_PHOTO"]),
          ),
        );

      // 3. Insert document rows in documents table
      await db.insert(documents).values([
        {
          userId: dto.userId,
          documentType: "AADHAAR",
          documentUrl: dto.aadhaar,
        },
        {
          userId: dto.userId,
          documentType: "SHOP_PHOTO",
          documentUrl: dto.shopPhoto,
        },
      ]);
    } catch (err) {
      console.log("Error saving shop documents:", err);
    }

    return {
      success: true,
      message:
        "Documents submitted successfully.",
    };
  }

  // =====================================
  // Shop Status
  // =====================================

  async status(id: string) {
    const userDocs = await db.query.documents.findMany({
      where: eq(documents.userId, id),
    });

    const hasAadhaar = userDocs.some((d) => d.documentType === "AADHAAR");
    const hasShopPhoto = userDocs.some((d) => d.documentType === "SHOP_PHOTO");

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    return {
      id,
      status: user?.status || "PENDING",

      documents: {
        aadhaar: hasAadhaar || Boolean(user?.aadhaar),
        shopPhoto: hasShopPhoto,
      },
    };
  }

  // =====================================
  // Shop Profile
  // =====================================

  async profile(
    userId: string,
  ) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          userId,
        ),
      });

    if (!shop) {
      throw new NotFoundException(
        "Shop not found.",
      );
    }

    // Documents & User verification info
    const userDocs = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const aadhaarDoc = userDocs.find((d) => d.documentType === "AADHAAR");
    const shopPhotoDoc = userDocs.find((d) => d.documentType === "SHOP_PHOTO");

    const documentsMap = {
      aadhaar: aadhaarDoc?.documentUrl || user?.aadhaar || null,
      shopPhoto: shopPhotoDoc?.documentUrl || null,
      status: user?.status || "PENDING",
    };

    // ===================================
    // CONNECTED AGENCIES
    // ===================================

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.shopId,
          shop.id,
        ),
      });

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
      });

    const deliveredOrdersCount =
      shopOrders.filter(
        (order) =>
          order.status ===
          "DELIVERED",
      ).length;

    // 5 points / coins per successfully delivered order from DB
    const realRewardPoints =
      deliveredOrdersCount * 5;

    return {
      success: true,

      shop: {
        ...shop,
        rewardPoints: realRewardPoints,
        walletBalance: 0,
        documents: documentsMap,
        userStatus: user?.status || "PENDING",
      },

      documents: documentsMap,

      stats: {
        connectedAgencies:
          connections.length,

        totalOrders:
          shopOrders.length,

        pendingOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          deliveredOrdersCount,

        rewardPoints:
          realRewardPoints,

        pointsPerOrder: 5,
      },
    };
  }

  // =====================================
  // Update Address & Store Details
  // =====================================

  async updateAddress(
    userId: string,
    body: {
      address?: string;
      pincode?: string;
      shopName?: string;
      ownerName?: string;
      phone?: string;
      landmark?: string;
    },
  ) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          userId,
        ),
      });

    if (!shop) {
      throw new NotFoundException(
        "Shop not found.",
      );
    }

    const updateFields: any = {};
    if (body.address !== undefined) updateFields.address = body.address.trim();
    if (body.pincode !== undefined) updateFields.pincode = body.pincode.trim();
    if (body.shopName !== undefined && body.shopName.trim()) updateFields.shopName = body.shopName.trim();
    if (body.ownerName !== undefined && body.ownerName.trim()) updateFields.ownerName = body.ownerName.trim();
    if (body.phone !== undefined && body.phone.trim()) updateFields.phone = body.phone.trim();

    const [updated] =
      await db
        .update(shops)
        .set(updateFields)
        .where(
          eq(
            shops.id,
            shop.id,
          ),
        )
        .returning();

    return {
      success: true,
      message:
        "Store details and delivery address updated successfully.",
      shop: updated,
    };
  }

  // =====================================
  // Dashboard (JWT)
  // =====================================

  async dashboard(
    userId: string,
  ) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          userId,
        ),
      });

    if (!shop) {
      throw new NotFoundException(
        "Shop not found.",
      );
    }

    // ===================================
    // TOTAL AGENCIES
    // ===================================

    const allAgencies =
      await db.query.agencies.findMany();

    // ===================================
    // CONNECTED AGENCIES
    // ===================================

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.shopId,
          shop.id,
        ),
      });

    // ===================================
    // ORDERS
    // ===================================

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),

        orderBy: (
          orders,
          { desc },
        ) => [
          desc(
            orders.createdAt,
          ),
        ],
      });

    const deliveredOrdersCount =
      shopOrders.filter(
        (order) =>
          order.status ===
          "DELIVERED",
      ).length;

    // Active slots for connected agencies
    const connectedAgencyIds = connections.map((c) => c.agencyId);
    let activeSlots: any[] = [];
    if (connectedAgencyIds.length > 0) {
      activeSlots = await db
        .select()
        .from(deliverySlots)
        .where(
          and(
            inArray(deliverySlots.agencyId, connectedAgencyIds),
            eq(deliverySlots.shopId, shop.id),
            eq(deliverySlots.isActive, "true"),
          ),
        );
    }

    const now = Date.now();
    const lateOrdersCount = shopOrders.filter((order) => {
      const isDelivered = order.status === "DELIVERED";
      const isCancelled = order.status === "CANCELLED";
      if (!isDelivered && !isCancelled && order.scheduledDate) {
        let scheduledDateTime = new Date(order.scheduledDate);
        if (order.createdAt) {
          const schedTime = new Date(order.scheduledDate).setHours(0, 0, 0, 0);
          const createdTime = new Date(order.createdAt).setHours(0, 0, 0, 0);
          if (schedTime < createdTime) {
            const slot = activeSlots.find(
              (s) => s.id === order.slotId || s.agencyId === order.agencyId,
            );
            if (slot) {
              scheduledDateTime = calculateNextDeliveryDate(
                slot,
                new Date(order.createdAt),
              );
            }
          }
        }
        scheduledDateTime.setHours(23, 59, 59, 999);
        return scheduledDateTime.getTime() < now;
      }
      return false;
    }).length;

    // 5 points / coins per successfully delivered order from DB
    const realRewardPoints =
      deliveredOrdersCount * 5;

    // ===================================
    // SLOT REMINDERS (Active slots without order)
    // ===================================
    const slotReminders: any[] = [];

    if (connectedAgencyIds.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingSlots = activeSlots.map((slot) => {
        const nextDate = calculateNextDeliveryDate(slot, today);
        return {
          ...slot,
          deliveryDate: nextDate,
        };
      });

      for (const slot of upcomingSlots) {
        const agency = allAgencies.find((a) => a.id === slot.agencyId);
        const slotDate = new Date(slot.deliveryDate);
        const slotDateEnd = new Date(slot.deliveryDate);
        slotDateEnd.setHours(23, 59, 59, 999);

        const existingOrder = shopOrders.find((ord) => {
          if (ord.agencyId !== slot.agencyId) return false;
          if (ord.status === "CANCELLED") return false;
          if (ord.slotId && ord.slotId === slot.id) return true;

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

          const ordCreated = new Date(ord.createdAt);
          const slotCreated = new Date(slot.createdAt);
          return ordCreated >= slotCreated && ordCreated <= slotDateEnd;
        });

        if (!existingOrder) {
          const nowDate = new Date();
          const diffMs = slotDateEnd.getTime() - nowDate.getTime();
          const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
          const isUrgent = diffHours <= 36;

          const formattedDate = slotDate.toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          slotReminders.push({
            slotId: slot.id,
            agencyId: slot.agencyId,
            agencyName: agency?.agencyName || "Connected Agency",
            agencyPhone: agency?.phone || "",
            ownerName: agency?.ownerName || "",
            deliveryDate: slot.deliveryDate,
            day: slot.day,
            formattedDate,
            isUrgent,
            hoursLeft: diffHours,
            message: `Agency ${agency?.agencyName || "Wholesaler"} has scheduled delivery for ${slot.day} (${formattedDate}). Please place your order before cutoff!`,
          });
        }
      }
    }

    return {
      success: true,

      shop: {
        ...shop,
        rewardPoints: realRewardPoints,
      },

      stats: {
        // =================================
        // AGENCY STATISTICS
        // =================================

        // All agencies registered
        // in the system
        totalAgencies:
          allAgencies.length,

        // Agencies connected
        // to this shop
        connectedAgencies:
          connections.length,

        // =================================
        // ORDER STATISTICS
        // =================================

        totalOrders:
          shopOrders.length,

        lateOrders:
          lateOrdersCount,

        notDeliveredOrders:
          lateOrdersCount,

        pendingOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          deliveredOrdersCount,

        rewardPoints:
          realRewardPoints,

        pointsPerOrder: 5,
      },

      // =================================
      // ACTIVE SLOT ORDERING REMINDERS
      // =================================
      slotReminders,

      // =================================
      // RECENT ORDERS
      // =================================

      recentOrders:
        shopOrders.slice(
          0,
          5,
        ),
    };
  }

  // =====================================
  // FREQUENTLY BOUGHT
  // =====================================

  async frequentlyBought(
    userId: string,
  ) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          userId,
        ),
      });

    if (!shop) {
      throw new NotFoundException(
        "Shop not found.",
      );
    }

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
      });

    const frequency =
      new Map<
        string,
        {
          orderedCount: number;
          lastOrdered: Date;
        }
      >();

    for (
      const order of shopOrders
    ) {
      const items =
        await db.query.orderItems.findMany({
          where: eq(
            orderItems.orderId,
            order.id,
          ),
        });

      for (
        const item of items
      ) {
        const existing =
          frequency.get(
            item.productId,
          );

        if (existing) {
          existing.orderedCount +=
            Number(
              item.cases,
            );

          if (
            order.createdAt >
            existing.lastOrdered
          ) {
            existing.lastOrdered =
              order.createdAt;
          }
        } else {
          frequency.set(
            item.productId,
            {
              orderedCount:
                Number(
                  item.cases,
                ),

              lastOrdered:
                order.createdAt,
            },
          );
        }
      }
    }

    const result: any[] = [];

    for (
      const [
        productId,
        stats,
      ] of frequency.entries()
    ) {
      const product =
        await db.query.products.findFirst({
          where: eq(
            products.id,
            productId,
          ),
        });

      if (!product) {
        continue;
      }

      let key =
        product.image;

      if (
        key.startsWith("http")
      ) {
        key = key
          .split("?")[0]
          .split("/")
          .pop()!;
      }

      let imageUrl = product.image;
      try {
        if (key && !key.startsWith("http") && !key.startsWith("data:")) {
          imageUrl = await this.s3Service.getSignedImageUrl(key);
        }
      } catch (err) {
        imageUrl = product.image;
      }

      result.push({
        id: product.id,

        name:
          product.name,

        image: imageUrl,

        unit:
          product.unit,

        quantityPerUnit:
          product.quantityPerUnit,

        price:
          Number(
            product.price,
          ),

        orderedCount:
          stats.orderedCount,

        lastOrdered:
          stats.lastOrdered,
      });
    }

    result.sort(
      (a, b) =>
        b.orderedCount -
        a.orderedCount,
    );

    return result.slice(
      0,
      10,
    );
  }
}