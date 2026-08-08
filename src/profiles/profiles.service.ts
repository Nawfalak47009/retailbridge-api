import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  agencies,
  shops,
  agencyProfiles,
  shopProfiles,
} from "../db/schema";

import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { CreateShopProfileDto } from "./dto/create-shop-profile.dto";

@Injectable()
export class ProfilesService {

  // =====================================
  // AGENCY PROFILE
  // =====================================

  async createAgencyProfile(
    userId: string,
    dto: CreateAgencyProfileDto,
  ) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          userId,
        ),
      });

    if (!agency) {
      throw new NotFoundException(
        "Agency not found.",
      );
    }

    const [profile] =
      await db
        .insert(agencyProfiles)
        .values({
          agencyId: agency.id,
          ...dto,
        })
        .returning();

    return {
      success: true,
      message:
        "Agency profile created successfully.",
      profile,
    };
  }

  // =====================================
  // GET AGENCY PROFILE
  // =====================================

  async getAgencyProfile(
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
      throw new NotFoundException(
        "Agency not found.",
      );
    }

    const profile =
      await db.query.agencyProfiles.findFirst({
        where: eq(
          agencyProfiles.agencyId,
          agency.id,
        ),
      });

    return {
      id: agency.id,

      agencyId:
        agency.id,

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

      gst:
        profile?.gst ?? "",
    };
  }

  // =====================================
  // UPDATE AGENCY PROFILE
  // =====================================

  async updateAgencyProfile(
    userId: string,
    dto: CreateAgencyProfileDto,
  ) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          userId,
        ),
      });

    if (!agency) {
      throw new NotFoundException(
        "Agency not found.",
      );
    }

    const existing =
      await db.query.agencyProfiles.findFirst({
        where: eq(
          agencyProfiles.agencyId,
          agency.id,
        ),
      });

    if (!existing) {
      return this.createAgencyProfile(
        userId,
        dto,
      );
    }

    const [profile] =
      await db
        .update(agencyProfiles)
        .set(dto)
        .where(
          eq(
            agencyProfiles.agencyId,
            agency.id,
          ),
        )
        .returning();

    return {
      success: true,

      message:
        "Agency profile updated successfully.",

      profile,
    };
  }

  // =====================================
  // SHOP PROFILE
  // =====================================

  async createShopProfile(
    userId: string,
    dto: CreateShopProfileDto,
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

    const [profile] =
      await db
        .insert(shopProfiles)
        .values({
          shopId: shop.id,
          ...dto,
        })
        .returning();

    return {
      success: true,

      message:
        "Shop profile created successfully.",

      profile,
    };
  }

  // =====================================
  // GET SHOP PROFILE
  // =====================================

  async getShopProfile(
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

    const profile =
      await db.query.shopProfiles.findFirst({
        where: eq(
          shopProfiles.shopId,
          shop.id,
        ),
      });

    return {
      id: shop.id,

      shopId:
        shop.id,

      shopName:
        shop.shopName,

      ownerName:
        shop.ownerName,

      phone:
        shop.phone,

      address:
        profile?.address ??
        shop.address,

      pincode:
        shop.pincode,

      deliveryNotes:
        profile?.deliveryNotes ??
        "",
    };
  }

  // =====================================
  // UPDATE SHOP PROFILE
  // =====================================

  async updateShopProfile(
    userId: string,
    dto: CreateShopProfileDto,
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

    const existing =
      await db.query.shopProfiles.findFirst({
        where: eq(
          shopProfiles.shopId,
          shop.id,
        ),
      });

    if (!existing) {
      return this.createShopProfile(
        userId,
        dto,
      );
    }

    const [profile] =
      await db
        .update(shopProfiles)
        .set(dto)
        .where(
          eq(
            shopProfiles.shopId,
            shop.id,
          ),
        )
        .returning();

    return {
      success: true,

      message:
        "Shop profile updated successfully.",

      profile,
    };
  }
}