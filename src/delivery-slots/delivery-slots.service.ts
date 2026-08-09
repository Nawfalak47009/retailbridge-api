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
} from "../db/schema";

import {
  CreateDeliverySlotDto,
} from "./dto/create-delivery-slot.dto";

@Injectable()
export class DeliverySlotsService {

  // ==========================================
  // CREATE DELIVERY SLOT
  // AGENCY ONLY
  // ==========================================

  async create(
    dto: CreateDeliverySlotDto,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can create delivery slots.",
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
        "You can only create slots for your own agency.",
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
    // Check duplicate slot
    // ------------------------------------------

    const existingSlot =
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
            deliverySlots.day,
            dto.day,
          ),
          eq(
            deliverySlots.startTime,
            dto.startTime,
          ),
          eq(
            deliverySlots.endTime,
            dto.endTime,
          ),
        ),
      });

    if (existingSlot) {
      throw new BadRequestException(
        "This delivery slot already exists for this shop.",
      );
    }

    // ------------------------------------------
    // Create slot
    // ------------------------------------------

    // ------------------------------------------
// Create delivery schedule
// ------------------------------------------

const [slot] =
  await db
    .insert(deliverySlots)
    .values({
      agencyId: dto.agencyId,
      shopId: dto.shopId,
      day: dto.day,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isActive: "true",
    })
    .returning();

    return {
      success: true,
      message:
        "Delivery slot created successfully.",
      slot,
    };
  }

  // ==========================================
  // AGENCY → ALL MY SLOTS
  // ==========================================

  async findByAgency(
    agencyId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access agency slots.",
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
        "You can only access your own agency slots.",
      );
    }

    return db
      .select()
      .from(deliverySlots)
      .where(
        eq(
          deliverySlots.agencyId,
          agencyId,
        ),
      );
  }

  // ==========================================
  // AGENCY → SLOTS FOR ONE CONNECTED SHOP
  // ==========================================

  async findByAgencyShop(
    agencyId: string,
    shopId: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can access agency slots.",
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
        "You can only access your own agency slots.",
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
    // Return slots
    // ------------------------------------------

    return db
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
  }

  // ==========================================
  // SHOP → CONNECTED AGENCY SLOTS
  // ==========================================

  async findByShop(
    shopId: string,
    user: any,
  ) {
    if (user.role !== "SHOP") {
      throw new ForbiddenException(
        "Only shops can access shop slots.",
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

    if (agencyIds.length === 0) {
      return [];
    }

    // ------------------------------------------
    // Return active slots
    // ------------------------------------------

    return db
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
  }

  // ==========================================
  // DELETE SLOT
  // AGENCY ONLY
  // ==========================================

  async remove(
    id: string,
    user: any,
  ) {
    if (user.role !== "AGENCY") {
      throw new ForbiddenException(
        "Only agencies can delete delivery slots.",
      );
    }

    const slot =
      await db.query.deliverySlots.findFirst({
        where: eq(
          deliverySlots.id,
          id,
        ),
      });

    if (!slot) {
      throw new BadRequestException(
        "Delivery slot not found.",
      );
    }

    // ------------------------------------------
    // Verify agency ownership
    // ------------------------------------------

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          slot.agencyId,
        ),
      });

    if (
      !agency ||
      agency.userId !== user.id
    ) {
      throw new ForbiddenException(
        "You can only delete your own agency slots.",
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
        "Delivery slot deleted successfully.",
    };
  }
}