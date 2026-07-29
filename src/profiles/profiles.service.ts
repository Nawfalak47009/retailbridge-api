import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  agencies,
  agencyProfiles,
  shopProfiles,
} from "../db/schema";

import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { CreateShopProfileDto } from "./dto/create-shop-profile.dto";

@Injectable()
export class ProfilesService {
  // ======================
  // Agency
  // ======================

  async createAgencyProfile(
    dto: CreateAgencyProfileDto,
  ) {
    const [profile] = await db
      .insert(agencyProfiles)
      .values(dto)
      .returning();

    return {
      success: true,
      message:
        "Agency profile created successfully.",
      profile,
    };
  }

  // Accept USER ID instead of Agency ID
async getAgencyProfile(userId: string) {
  const agency = await db.query.agencies.findFirst({
    where: eq(agencies.userId, userId),
  });

  if (!agency) {
    return {
      success: false,
      message: "Agency not found",
    };
  }

  const profile = await db.query.agencyProfiles.findFirst({
    where: eq(
      agencyProfiles.agencyId,
      agency.id,
    ),
  });

  return {
    id: agency.id,
    agencyId: agency.id,

    // From agencies table
    agencyName: agency.agencyName,
    ownerName: agency.ownerName,
    phone: agency.phone,

    // From agency_profiles table
    address: profile?.address ?? "",
    logo: profile?.logo ?? "",
    description: profile?.description ?? "",
    gst: profile?.gst ?? "",
  };
}

  // ======================
  // Shop
  // ======================

  async createShopProfile(
    dto: CreateShopProfileDto,
  ) {
    const [profile] = await db
      .insert(shopProfiles)
      .values(dto)
      .returning();

    return {
      success: true,
      message:
        "Shop profile created successfully.",
      profile,
    };
  }

  async getShopProfile(
    shopId: string,
  ) {
    return db.query.shopProfiles.findFirst({
      where: eq(
        shopProfiles.shopId,
        shopId,
      ),
    });
  }
}