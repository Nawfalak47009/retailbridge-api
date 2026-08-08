import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  eq,
  and,
  sql,
} from "drizzle-orm";

import { db } from "../db";

import {
  agencyShopRequests,
  agencyShopConnections,
  agencies,
  shops,
} from "../db/schema";

import { CreateRequestDto } from "./dto/create-request.dto";

@Injectable()
export class AgencyConnectionsService {

  // ==========================================
  // SEND CONNECTION REQUEST
  // ==========================================

  async createRequest(
    dto: CreateRequestDto,
    user: any,
  ) {
    // SHOP is requesting
    if (dto.requestedBy === "SHOP") {
      if (user.role !== "SHOP") {
        throw new ForbiddenException(
          "Only a shop can send a shop request.",
        );
      }

      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.id,
            dto.shopId,
          ),
        });

      if (!shop) {
        throw new BadRequestException(
          "Shop not found.",
        );
      }

      if (shop.userId !== user.id) {
        throw new ForbiddenException(
          "You can only send requests for your own shop.",
        );
      }
    }

    // AGENCY is requesting
    if (dto.requestedBy === "AGENCY") {
      if (user.role !== "AGENCY") {
        throw new ForbiddenException(
          "Only an agency can send an agency request.",
        );
      }

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
          "You can only send requests for your own agency.",
        );
      }
    }

    const existingRequest =
      await db.query.agencyShopRequests.findFirst({
        where: and(
          eq(
            agencyShopRequests.agencyId,
            dto.agencyId,
          ),
          eq(
            agencyShopRequests.shopId,
            dto.shopId,
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

    const existingConnection =
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

    if (existingConnection) {
      throw new BadRequestException(
        "Agency and shop are already connected.",
      );
    }

    const [request] =
      await db
        .insert(agencyShopRequests)
        .values({
          agencyId: dto.agencyId,
          shopId: dto.shopId,
          requestedBy: dto.requestedBy,
          status: "PENDING",
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
        "You can only access your own agency requests.",
      );
    }

    return db
      .select()
      .from(agencyShopRequests)
      .where(
        and(
          eq(
            agencyShopRequests.agencyId,
            agencyId,
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

    // Only the receiving side can accept
    if (request.requestedBy === "SHOP") {
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

    if (request.requestedBy === "AGENCY") {
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

    if (!existingConnection) {
      await db
        .insert(agencyShopConnections)
        .values({
          agencyId: request.agencyId,
          shopId: request.shopId,
        });
    }

    await db
      .update(agencyShopRequests)
      .set({
        status: "ACCEPTED",
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

    if (request.requestedBy === "SHOP") {
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

    if (request.requestedBy === "AGENCY") {
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

    await db
      .update(agencyShopRequests)
      .set({
        status: "REJECTED",
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
    if (user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access their agencies.",
      );
    }

    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          shopId,
        ),
      });

    if (!shop || shop.userId !== user.id) {
      throw new ForbiddenException(
        "You can only access your own agencies.",
      );
    }

    return db
      .select({
        connectionId:
          agencyShopConnections.id,

        agencyId:
          agencies.id,

        agencyName:
          agencies.agencyName,

        ownerName:
          agencies.ownerName,

        phone:
          agencies.phone,

        connectedAt:
          agencyShopConnections.connectedAt,
      })
      .from(agencyShopConnections)
      .innerJoin(
  shops,
  sql`${agencyShopConnections.shopId}::uuid = ${shops.id}`,
)
      .where(
        eq(
          agencyShopConnections.shopId,
          shopId,
        ),
      );
  }

  // ==========================================
  // AGENCY → MY SHOPS
  // ==========================================

  async getMyShops(
    agencyId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access their shops.",
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
        "You can only access your own shops.",
      );
    }

    return db
      .select({
        connectionId:
          agencyShopConnections.id,

        shopId:
          shops.id,

        shopName:
          shops.shopName,

        ownerName:
          shops.ownerName,

        phone:
          shops.phone,

        address:
          shops.address,

        pincode:
          shops.pincode,

        connectedAt:
          agencyShopConnections.connectedAt,
      })
      .from(agencyShopConnections)
      .innerJoin(
        shops,
        eq(
          agencyShopConnections.shopId,
          shops.id,
        ),
      )
      .where(
        eq(
          agencyShopConnections.agencyId,
          agencyId,
        ),
      );
  }
}