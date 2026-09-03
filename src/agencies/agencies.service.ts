import {
  Injectable,
} from "@nestjs/common";

import { eq, and } from "drizzle-orm";

import { db } from "../db";
import { calculateNextDeliveryDate } from "../delivery-slots/delivery-slots.utils";

import {
  agencies,
  agencyProfiles,
  agencyShopConnections,
  users,
  products,
  orders,
  orderItems,
  shops,
  deliverySlots,
} from "../db/schema";

@Injectable()
export class AgenciesService {

  // ==========================================
  // ALL APPROVED AGENCIES
  // ==========================================

  async findAll(userId?: string) {
    let currentShopId: string | null = null;
    if (userId) {
      const currentShop = await db.query.shops.findFirst({
        where: eq(shops.userId, userId),
      });
      if (currentShop) {
        currentShopId = currentShop.id;
      }
    }

    const agencyList =
      await db.query.agencies.findMany();

    const result: {
      id: string;
      agencyName: string;
      ownerName: string;
      phone: string;
      address: string;
      logo: string;
      description: string;
      productCount: number;
      shopCount: number;
      categories: string[];
      connected: boolean;
      slot?: {
        id?: string;
        day: string;
        deliveryDate: Date;
        formattedDate: string;
      } | null;
      hasOrdered?: boolean;
      cardColor?: "green" | "red";
      orderStatusText?: string;
    }[] = [];

    for (
      const agency of agencyList
    ) {

      // ========================================
      // ONLY APPROVED AGENCIES
      // ========================================

      const user =
        await db.query.users.findFirst({
          where: eq(
            users.id,
            agency.userId,
          ),
        });

      if (
        !user ||
        user.status !== "APPROVED"
      ) {
        continue;
      }

      // ========================================
      // AGENCY PROFILE
      // ========================================

      const profile =
        await db.query.agencyProfiles.findFirst({
          where: eq(
            agencyProfiles.agencyId,
            agency.id,
          ),
        });

      // ========================================
      // PRODUCTS
      // ========================================

      const productList =
        await db.query.products.findMany({
          where: eq(
            products.agencyId,
            agency.id,
          ),
        });

      // ========================================
      // CONNECTED SHOPS
      // ========================================

      const connections =
        await db.query.agencyShopConnections.findMany({
          where: eq(
            agencyShopConnections.agencyId,
            agency.id,
          ),
        });

      const isConnected = currentShopId
        ? connections.some((c) => c.shopId === currentShopId)
        : false;

      const categories = [
        ...new Set(
          productList.map(
            (product) =>
              product.category,
          ),
        ),
      ];

      let slotInfo: any = null;
      let hasOrdered = false;

      if (currentShopId && isConnected) {
        const activeSlot = await db.query.deliverySlots.findFirst({
          where: and(
            eq(deliverySlots.agencyId, agency.id),
            eq(deliverySlots.shopId, currentShopId),
            eq(deliverySlots.isActive, "true"),
          ),
        });

        const agencyOrders = await db.query.orders.findMany({
          where: and(
            eq(orders.shopId, currentShopId),
            eq(orders.agencyId, agency.id),
          ),
          orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        });

        const activeOrder = agencyOrders.find((ord) => ord.status !== "CANCELLED");

        if (activeSlot) {
          const nextDate = calculateNextDeliveryDate(activeSlot, new Date());
          const formattedDate = nextDate.toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          slotInfo = {
            id: activeSlot.id,
            day: activeSlot.day,
            deliveryDate: nextDate,
            formattedDate,
          };

          const slotDate = new Date(nextDate);
          const slotDateEnd = new Date(nextDate);
          slotDateEnd.setHours(23, 59, 59, 999);

          // Previous cycle end / cutoff (7 days before this slot date)
          const cycleStart = new Date(slotDate);
          cycleStart.setDate(cycleStart.getDate() - 7);
          cycleStart.setHours(0, 0, 0, 0);

          const orderForSlot = agencyOrders.find((ord) => {
            if (ord.status === "CANCELLED") return false;

            // 1. Explicit slot ID match
            if (ord.slotId && ord.slotId === activeSlot.id) {
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
              if (ordCreated >= cycleStart && ordCreated <= slotDateEnd && ord.status !== "DELIVERED") {
                return true;
              }
            }

            // 2. Scheduled date matches slot date
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

            // 3. Active order created in this cycle before the slot date
            const ordCreated = new Date(ord.createdAt);
            if (ordCreated >= cycleStart && ordCreated <= slotDateEnd && ord.status !== "DELIVERED") {
              return true;
            }

            return false;
          });

          hasOrdered = Boolean(orderForSlot);
        } else {
          // If no slot created by agency yet, check if shop placed an active non-delivered order
          hasOrdered = Boolean(activeOrder && activeOrder.status !== "DELIVERED");
        }
      }

      const orderStatusText = hasOrdered
        ? (slotInfo?.day ? `Ordered for ${slotInfo.day} Delivery` : "Order Placed & Scheduled")
        : (slotInfo?.day ? `Not Ordered for ${slotInfo.day}` : "Not Ordered Yet");

      result.push({
        id: agency.id,

        agencyName:
          agency.agencyName,

        ownerName:
          agency.ownerName,

        phone:
          agency.phone,

        address:
          profile?.address ?? "",

        logo:
          profile?.logo || (agency as any)?.logo || "",

        description:
          profile?.description ?? "",

        productCount:
          productList.length,

        shopCount:
          connections.length,

        categories,

        connected: isConnected,
        slot: slotInfo,
        hasOrdered: isConnected ? hasOrdered : false,
        cardColor: isConnected ? (hasOrdered ? "green" : "red") : undefined,
        orderStatusText: isConnected ? orderStatusText : undefined,
      });
    }

    return result;
  }

  // ==========================================
  // SINGLE AGENCY
  // ==========================================

  async findOne(
    id: string,
  ) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          id,
        ),
      });

    if (!agency) {
      return {
        success: false,
        message:
          "Agency not found",
      };
    }

    const profile =
      await db.query.agencyProfiles.findFirst({
        where: eq(
          agencyProfiles.agencyId,
          agency.id,
        ),
      });

    const productList =
      await db.query.products.findMany({
        where: eq(
          products.agencyId,
          agency.id,
        ),
      });

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.agencyId,
          agency.id,
        ),
      });

    const categories = [
      ...new Set(
        productList.map(
          (product) =>
            product.category,
        ),
      ),
    ];

    return {
      success: true,

      agency: {
        id: agency.id,

        agencyName:
          agency.agencyName,

        ownerName:
          agency.ownerName,

        phone:
          agency.phone,

        address:
          profile?.address ?? "",

        logo:
          profile?.logo ?? "",

        description:
          profile?.description ?? "",

        productCount:
          productList.length,

        shopCount:
          connections.length,

        categories,
      },
    };
  }

  // ==========================================
  // AGENCY DASHBOARD
  // ==========================================

  async dashboard(
    userId: string,
  ) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          userId,
        ),
      });

    if (!agency) {
      return {
        success: false,
        message:
          "Agency not found",
      };
    }

    const profile =
      await db.query.agencyProfiles.findFirst({
        where: eq(
          agencyProfiles.agencyId,
          agency.id,
        ),
      });

    const productList =
      await db.query.products.findMany({
        where: eq(
          products.agencyId,
          agency.id,
        ),
      });

    const agencyOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.agencyId,
          agency.id,
        ),
      });

    // ========================================
    // CONNECTED SHOPS
    // ========================================

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.agencyId,
          agency.id,
        ),
      });

    let totalRevenue = 0;
    let totalCasesSold = 0;

    const productSales: Record<
      string,
      {
        name: string;
        sold: number;
      }
    > = {};

    const shopOrders: Record<
      string,
      {
        shopName: string;
        orders: number;
      }
    > = {};

    // ========================================
    // PROCESS DELIVERED ORDERS
    // ========================================

    for (
      const order of agencyOrders
    ) {

      if (
        order.status !==
        "DELIVERED"
      ) {
        continue;
      }

      totalRevenue +=
        Number(
          order.totalAmount ?? 0,
        );

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
        totalCasesSold +=
          Number(
            item.cases ?? 0,
          );

        const product =
          await db.query.products.findFirst({
            where: eq(
              products.id,
              item.productId,
            ),
          });

        if (product) {

          if (
            !productSales[
              product.id
            ]
          ) {
            productSales[
              product.id
            ] = {
              name:
                product.name,

              sold: 0,
            };
          }

          productSales[
            product.id
          ].sold +=
            Number(
              item.cases,
            );
        }
      }

      // ======================================
      // SHOP
      // ======================================

      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.id,
            order.shopId,
          ),
        });

      if (shop) {

        if (
          !shopOrders[
            shop.id
          ]
        ) {
          shopOrders[
            shop.id
          ] = {
            shopName:
              shop.shopName,

            orders: 0,
          };
        }

        shopOrders[
          shop.id
        ].orders++;
      }
    }

    // ========================================
    // TOP PRODUCTS
    // ========================================

    const topProducts =
      Object.values(
        productSales,
      )
        .sort(
          (a, b) =>
            b.sold -
            a.sold,
        )
        .slice(0, 5);

    // ========================================
    // TOP SHOPS
    // ========================================

    const topShops =
      Object.values(
        shopOrders,
      )
        .sort(
          (a, b) =>
            b.orders -
            a.orders,
        )
        .slice(0, 5);

    return {
      success: true,

      agency: {
        agencyName:
          agency.agencyName,

        ownerName:
          agency.ownerName,

        phone:
          agency.phone,

        address:
          profile?.address ??
          "",

        logo:
          profile?.logo ||
          (agency as any)?.logo ||
          "",
      },

      stats: {
        totalRevenue,

        totalProducts:
          productList.length,

        activeProducts:
          productList.filter(
            (p) =>
              p.isActive ===
              "true",
          ).length,

        outOfStock:
          productList.filter(
            (p) =>
              Number(
                p.stock,
              ) <= 0,
          ).length,

        connectedShops:
          connections.length,

        totalOrders:
          agencyOrders.length,

        pendingOrders:
          agencyOrders.filter(
            (o) =>
              o.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          agencyOrders.filter(
            (o) =>
              o.status ===
              "DELIVERED",
          ).length,

        totalCasesSold,
      },

      topProducts,

      topShops,
    };
  }

  // ==========================================
  // UPDATE AGENCY PROFILE
  // ==========================================

  async updateProfile(
    userId: string,
    body: {
      agencyName?: string;
      ownerName?: string;
      phone?: string;
      address?: string;
      logo?: string;
    },
  ) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          userId,
        ),
      });

    if (!agency) {
      return {
        success: false,
        message:
          "Agency not found",
      };
    }

    // Update agency
    const agencyUpdate: any = {};
    if (body.agencyName !== undefined && body.agencyName.trim()) agencyUpdate.agencyName = body.agencyName.trim();
    if (body.ownerName !== undefined && body.ownerName.trim()) agencyUpdate.ownerName = body.ownerName.trim();
    if (body.phone !== undefined && body.phone.trim()) agencyUpdate.phone = body.phone.trim();
    if (body.logo !== undefined) agencyUpdate.logo = body.logo.trim();

    if (Object.keys(agencyUpdate).length > 0) {
      await db
        .update(agencies)
        .set(agencyUpdate)
        .where(
          eq(
            agencies.id,
            agency.id,
          ),
        );
    }

    // Update or create agency profile
    const existingProfile = await db.query.agencyProfiles.findFirst({
      where: eq(agencyProfiles.agencyId, agency.id),
    });

    const profileUpdate: any = {};
    if (body.address !== undefined) profileUpdate.address = body.address.trim();
    if (body.logo !== undefined) profileUpdate.logo = body.logo.trim();

    if (existingProfile) {
      if (Object.keys(profileUpdate).length > 0) {
        await db
          .update(agencyProfiles)
          .set(profileUpdate)
          .where(
            eq(
              agencyProfiles.agencyId,
              agency.id,
            ),
          );
      }
    } else {
      await db.insert(agencyProfiles).values({
        agencyId: agency.id,
        address: body.address || "",
        logo: body.logo || "",
      });
    }

    return {
      success: true,
      message:
        "Profile updated successfully.",
    };
  }
}