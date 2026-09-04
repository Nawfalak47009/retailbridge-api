import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  eq,
  and,
} from "drizzle-orm";

import { db } from "../db";

import {
  agencyShopRequests,
  agencyShopConnections,
  agencies,
  shops,
  deliverySlots,
  orders,
} from "../db/schema";

import { CreateRequestDto } from "./dto/create-request.dto";
import { calculateNextDeliveryDate } from "../delivery-slots/delivery-slots.utils";

@Injectable()
export class AgencyConnectionsService {

  // ==========================================
  // SEND CONNECTION REQUEST
  // ==========================================

  async createRequest(
    dto: CreateRequestDto,
    user: any,
  ) {
    // ==========================================
    // SHOP IS REQUESTING
    // ==========================================

    let actualShopId = dto.shopId;
    let actualAgencyId = dto.agencyId;

    if (dto.requestedBy === "SHOP") {
      if (user.role !== "SHOP") {
        throw new ForbiddenException(
          "Only a shop can send a shop request.",
        );
      }

      let shop: any = null;
      if (dto.shopId) {
        shop = await db.query.shops.findFirst({
          where: eq(shops.id, dto.shopId),
        });
      }

      if (!shop) {
        shop = await db.query.shops.findFirst({
          where: eq(shops.userId, user.id),
        });
      }

      if (!shop && dto.shopId) {
        shop = await db.query.shops.findFirst({
          where: eq(shops.userId, dto.shopId),
        });
      }

      if (!shop) {
        throw new BadRequestException(
          "Shop not found.",
        );
      }

      actualShopId = shop.id;
    }

    // ==========================================
    // AGENCY IS REQUESTING
    // ==========================================

    if (dto.requestedBy === "AGENCY") {
      if (user.role !== "AGENCY") {
        throw new ForbiddenException(
          "Only an agency can send an agency request.",
        );
      }

      let agency: any = null;
      if (dto.agencyId) {
        agency = await db.query.agencies.findFirst({
          where: eq(agencies.id, dto.agencyId),
        });
      }

      if (!agency) {
        agency = await db.query.agencies.findFirst({
          where: eq(agencies.userId, user.id),
        });
      }

      if (!agency) {
        throw new BadRequestException(
          "Agency not found.",
        );
      }

      actualAgencyId = agency.id;
    }

    // ==========================================
    // CHECK EXISTING PENDING REQUEST
    // ==========================================

    const existingRequest =
      await db.query.agencyShopRequests.findFirst({
        where: and(
          eq(
            agencyShopRequests.agencyId,
            actualAgencyId,
          ),
          eq(
            agencyShopRequests.shopId,
            actualShopId,
          ),
          eq(
            agencyShopRequests.status,
            "PENDING",
          ),
        ),
      });

    if (existingRequest) {
      throw new BadRequestException(
        "A pending connection request already exists.",
      );
    }

    // ==========================================
    // CHECK EXISTING CONNECTION
    // ==========================================

    const existingConnection =
      await db.query.agencyShopConnections.findFirst({
        where: and(
          eq(
            agencyShopConnections.agencyId,
            actualAgencyId,
          ),
          eq(
            agencyShopConnections.shopId,
            actualShopId,
          ),
        ),
      });

    if (existingConnection) {
      throw new BadRequestException(
        "Agency and shop are already connected.",
      );
    }

    // ==========================================
    // CREATE REQUEST
    // ==========================================

    const [request] =
      await db
        .insert(
          agencyShopRequests,
        )
        .values({
          agencyId:
            actualAgencyId,

          shopId:
            actualShopId,

          requestedBy:
            dto.requestedBy,

          status:
            "PENDING",
        })
        .returning();

    return {
      success: true,

      message:
        "Connection request sent successfully.",

      request,
    };
  }

  // ==========================================
  // AGENCY INCOMING REQUESTS
  // ==========================================

  async getAgencyIncomingRequests(
    agencyId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access agency requests.",
      );
    }

    let agency: any = null;
    if (agencyId) {
      agency = await db.query.agencies.findFirst({
        where: eq(agencies.id, agencyId),
      });
    }

    if (!agency) {
      agency = await db.query.agencies.findFirst({
        where: eq(agencies.userId, user.id),
      });
    }

    if (!agency && agencyId) {
      agency = await db.query.agencies.findFirst({
        where: eq(agencies.userId, agencyId),
      });
    }

    if (!agency) {
      throw new BadRequestException(
        "Agency not found.",
      );
    }

    const requests = await db
      .select()
      .from(agencyShopRequests)
      .where(
        and(
          eq(
            agencyShopRequests.agencyId,
            agency.id,
          ),
          eq(
            agencyShopRequests.requestedBy,
            "SHOP",
          ),
          eq(
            agencyShopRequests.status,
            "PENDING",
          ),
        ),
      );

    return Promise.all(
      requests.map(async (req) => {
        let shop = await db.query.shops.findFirst({
          where: eq(shops.id, req.shopId),
        });

        if (!shop) {
          shop = await db.query.shops.findFirst({
            where: eq(shops.userId, req.shopId),
          });
        }

        return {
          ...req,
          shop: shop
            ? {
                id: shop.id,
                customId: (shop as any)?.customId || null,
                shopName: shop.shopName,
                ownerName: shop.ownerName,
                phone: shop.phone,
                address: shop.address,
                landmark: (shop as any)?.landmark || null,
                pincode: shop.pincode,
                image: (shop as any)?.image || null,
              }
            : null,
        };
      }),
    );
  }

  // ==========================================
  // SHOP INCOMING REQUESTS
  // ==========================================

  async getShopIncomingRequests(
    shopId: string,
    user: any,
  ) {
    if (user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access shop requests.",
      );
    }

    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          shopId,
        ),
      });

    if (!shop) {
      throw new BadRequestException(
        "Shop not found.",
      );
    }

    if (shop.userId !== user.id) {
      throw new ForbiddenException(
        "You can only access your own shop requests.",
      );
    }

    return db
      .select()
      .from(agencyShopRequests)
      .where(
        and(
          eq(
            agencyShopRequests.shopId,
            shopId,
          ),
          eq(
            agencyShopRequests.requestedBy,
            "AGENCY",
          ),
          eq(
            agencyShopRequests.status,
            "PENDING",
          ),
        ),
      );
  }

  // ==========================================
  // ACCEPT REQUEST
  // ==========================================

  async acceptRequest(
    id: string,
    user: any,
  ) {
    const request =
      await db.query.agencyShopRequests.findFirst({
        where: eq(
          agencyShopRequests.id,
          id,
        ),
      });

    if (!request) {
      throw new BadRequestException(
        "Connection request not found.",
      );
    }

    if (request.status !== "PENDING") {
      throw new BadRequestException(
        "This request has already been processed.",
      );
    }

    // ==========================================
    // SHOP REQUEST → AGENCY ACCEPTS
    // ==========================================

    if (
      request.requestedBy === "SHOP"
    ) {
      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            request.agencyId,
          ),
        });

      if (
        !agency ||
        agency.userId !== user.id ||
        user.role !== "AGENCY"
      ) {
        throw new ForbiddenException(
          "Only the receiving agency can accept this request.",
        );
      }
    }

    // ==========================================
    // AGENCY REQUEST → SHOP ACCEPTS
    // ==========================================

    if (
      request.requestedBy === "AGENCY"
    ) {
      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.id,
            request.shopId,
          ),
        });

      if (
        !shop ||
        shop.userId !== user.id ||
        user.role !== "SHOP"
      ) {
        throw new ForbiddenException(
          "Only the receiving shop can accept this request.",
        );
      }
    }

    // ==========================================
    // CHECK EXISTING CONNECTION
    // ==========================================

    const existingConnection =
      await db.query.agencyShopConnections.findFirst({
        where: and(
          eq(
            agencyShopConnections.agencyId,
            request.agencyId,
          ),
          eq(
            agencyShopConnections.shopId,
            request.shopId,
          ),
        ),
      });

    // ==========================================
    // CREATE CONNECTION
    // ==========================================

    if (!existingConnection) {
      await db
        .insert(agencyShopConnections)
        .values({
          agencyId:
            request.agencyId,

          shopId:
            request.shopId,
        });
    }

    // ==========================================
    // UPDATE REQUEST
    // ==========================================

    await db
      .update(agencyShopRequests)
      .set({
        status:
          "ACCEPTED",
      })
      .where(
        eq(
          agencyShopRequests.id,
          id,
        ),
      );

    return {
      success: true,

      message:
        "Connection request accepted.",
    };
  }

  // ==========================================
  // REJECT REQUEST
  // ==========================================

  async rejectRequest(
    id: string,
    user: any,
  ) {
    const request =
      await db.query.agencyShopRequests.findFirst({
        where: eq(
          agencyShopRequests.id,
          id,
        ),
      });

    if (!request) {
      throw new BadRequestException(
        "Connection request not found.",
      );
    }

    if (request.status !== "PENDING") {
      throw new BadRequestException(
        "This request has already been processed.",
      );
    }

    // ==========================================
    // SHOP REQUEST → AGENCY REJECTS
    // ==========================================

    if (
      request.requestedBy === "SHOP"
    ) {
      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            request.agencyId,
          ),
        });

      if (
        !agency ||
        agency.userId !== user.id ||
        user.role !== "AGENCY"
      ) {
        throw new ForbiddenException(
          "Only the receiving agency can reject this request.",
        );
      }
    }

    // ==========================================
    // AGENCY REQUEST → SHOP REJECTS
    // ==========================================

    if (
      request.requestedBy === "AGENCY"
    ) {
      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.id,
            request.shopId,
          ),
        });

      if (
        !shop ||
        shop.userId !== user.id ||
        user.role !== "SHOP"
      ) {
        throw new ForbiddenException(
          "Only the receiving shop can reject this request.",
        );
      }
    }

    // ==========================================
    // UPDATE REQUEST
    // ==========================================

    await db
      .update(agencyShopRequests)
      .set({
        status:
          "REJECTED",
      })
      .where(
        eq(
          agencyShopRequests.id,
          id,
        ),
      );

    // Remove connection if exists
    await db
      .delete(agencyShopConnections)
      .where(
        and(
          eq(agencyShopConnections.agencyId, request.agencyId),
          eq(agencyShopConnections.shopId, request.shopId),
        ),
      );

    return {
      success: true,

      message:
        "Connection request rejected.",
    };
  }

  // ==========================================
  // SHOP → MY AGENCIES
  // ==========================================

  async getMyAgencies(
    shopId: string,
    user: any,
  ) {
    // ------------------------------------------
    // Verify role
    // ------------------------------------------

    if (user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access their agencies.",
      );
    }

    // ------------------------------------------
    // Verify shop
    // ------------------------------------------

    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          shopId,
        ),
      });

    if (!shop) {
      throw new BadRequestException(
        "Shop not found.",
      );
    }

    if (shop.userId !== user.id) {
      throw new ForbiddenException(
        "You can only access your own agencies.",
      );
    }

    // ------------------------------------------
    // Get connections
    // ------------------------------------------

    const connections =
      await db
        .select({
          connectionId:
            agencyShopConnections.id,

          agencyId:
            agencyShopConnections.agencyId,

          connectedAt:
            agencyShopConnections.connectedAt,
        })
        .from(
          agencyShopConnections,
        )
        .where(
          eq(
            agencyShopConnections.shopId,
            shopId,
          ),
        );

    // ------------------------------------------
    // No connections
    // ------------------------------------------

    if (connections.length === 0) {
      return [];
    }

    // ------------------------------------------
    // Load agency details
    // ------------------------------------------

    const result: Array<{
      connectionId: string;
      agencyId: string;
      agencyName: string;
      ownerName: string;
      phone: string;
      logo?: string | null;
      connectedAt: Date | null;
      slot?: {
        id?: string;
        day: string;
        deliveryDate: Date;
        formattedDate: string;
      } | null;
      hasOrdered: boolean;
      cardColor: "green" | "red";
      orderStatusText: string;
      lastOrderId?: string | null;
      lastOrderStatus?: string | null;
    }> = [];

    for (
      const connection of connections
    ) {
      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            connection.agencyId,
          ),
        });

      // Ignore stale connection records
      if (!agency) {
        continue;
      }

      const req = await db.query.agencyShopRequests.findFirst({
        where: and(
          eq(agencyShopRequests.agencyId, connection.agencyId),
          eq(agencyShopRequests.shopId, shopId),
        ),
      });

      if (req && req.status !== "ACCEPTED") {
        continue;
      }

      // 1. Get active delivery slot for this shop and agency
      const activeSlot = await db.query.deliverySlots.findFirst({
        where: and(
          eq(deliverySlots.agencyId, connection.agencyId),
          eq(deliverySlots.shopId, shopId),
          eq(deliverySlots.isActive, "true"),
        ),
      });

      // 2. Query shop orders for this agency
      const agencyOrders = await db.query.orders.findMany({
        where: and(
          eq(orders.shopId, shopId),
          eq(orders.agencyId, connection.agencyId),
        ),
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      });

      let slotInfo: any = null;
      let hasOrdered = false;
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

        // Previous cycle cutoff (7 days before slot)
        const cycleStart = new Date(slotDate);
        cycleStart.setDate(cycleStart.getDate() - 7);
        cycleStart.setHours(0, 0, 0, 0);

        const orderForSlot = agencyOrders.find((ord) => {
          if (ord.status === "CANCELLED") return false;

          // 1. Explicit slot match
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

        hasOrdered = Boolean(
          orderForSlot ||
          (activeOrder && activeOrder.status !== "DELIVERED" && activeOrder.status !== "CANCELLED")
        );
      } else {
        // If no slot created by agency yet, check if shop placed an active non-delivered order
        hasOrdered = Boolean(activeOrder && activeOrder.status !== "DELIVERED" && activeOrder.status !== "CANCELLED");
      }

      const orderStatusText = hasOrdered
        ? (slotInfo?.day ? `Ordered for ${slotInfo.day} Delivery` : "Order Placed & Scheduled")
        : (slotInfo?.day ? `Not Ordered for ${slotInfo.day}` : "Not Ordered Yet");

      result.push({
        connectionId:
          connection.connectionId,

        agencyId:
          agency.id,

        agencyName:
          agency.agencyName,

        ownerName:
          agency.ownerName,

        phone:
          agency.phone,

        logo:
          agency.logo || null,

        connectedAt:
          connection.connectedAt,

        slot: slotInfo,
        hasOrdered,
        cardColor: hasOrdered ? "green" : "red",
        orderStatusText,
        lastOrderId: activeOrder?.id || null,
        lastOrderStatus: activeOrder?.status || null,
      });
    }

    return result;
  }

  // ==========================================
  // AGENCY → MY SHOPS
  // ==========================================

  async getMyShops(
    agencyId: string,
    user: any,
  ) {
    // ------------------------------------------
    // Authorization
    // ------------------------------------------

    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access their shops.",
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

    if (!agency) {
      throw new BadRequestException(
        "Agency not found.",
      );
    }

    if (agency.userId !== user.id) {
      throw new ForbiddenException(
        "You can only access your own shops.",
      );
    }

    // ------------------------------------------
    // Get connections
    // ------------------------------------------

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.agencyId,
          agencyId,
        ),
      });

    // ------------------------------------------
    // No connections
    // ------------------------------------------

    if (connections.length === 0) {
      return [];
    }

    // ------------------------------------------
    // Load shop details
    // ------------------------------------------

    const result: Array<{
      connectionId: string;
      shopId: string;
      customId?: string | null;
      shopName: string;
      ownerName: string;
      phone: string;
      address: string | null;
      landmark?: string | null;
      pincode: string | null;
      image?: string | null;
      connectedAt: Date | null;
    }> = [];

    for (
      const connection of connections
    ) {
      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.id,
            connection.shopId,
          ),
        });

      // Ignore stale connection records
      if (!shop) {
        continue;
      }

      const req = await db.query.agencyShopRequests.findFirst({
        where: and(
          eq(agencyShopRequests.agencyId, agencyId),
          eq(agencyShopRequests.shopId, connection.shopId),
        ),
      });

      if (req && req.status !== "ACCEPTED") {
        continue;
      }

      result.push({
        connectionId:
          connection.id,

        shopId:
          shop.id,

        customId:
          (shop as any)?.customId || null,

        shopName:
          shop.shopName,

        ownerName:
          shop.ownerName,

        phone:
          shop.phone,

        address:
          shop.address,

        landmark:
          (shop as any)?.landmark || null,

        pincode:
          shop.pincode,

        image:
          (shop as any)?.image || null,

        connectedAt:
          connection.connectedAt,
      });
    }

    return result;
  }
}