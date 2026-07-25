import { Injectable } from "@nestjs/common";

import { eq } from "drizzle-orm";

import { db } from "../db";

import {
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
    const [profile] =
      await db
        .insert(
          agencyProfiles,
        )
        .values(dto)
        .returning();

    return {
      success: true,
      message:
        "Agency profile created successfully.",
      profile,
    };
  }

  async getAgencyProfile(
    agencyId: string,
  ) {
    return db.query.agencyProfiles.findFirst(
      {
        where: eq(
          agencyProfiles.agencyId,
          agencyId,
        ),
      },
    );
  }

  // ======================
  // Shop
  // ======================

  async createShopProfile(
    dto: CreateShopProfileDto,
  ) {
    const [profile] =
      await db
        .insert(
          shopProfiles,
        )
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
    return db.query.shopProfiles.findFirst(
      {
        where: eq(
          shopProfiles.shopId,
          shopId,
        ),
      },
    );
  }
}