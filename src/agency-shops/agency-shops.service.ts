import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  agencies,
  agencyShops,
  shops,
} from "../db/schema";

import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";

@Injectable()
export class AgencyShopsService {
  // =====================================
  // Connect Shop
  // =====================================

  async create(
    userId: string,
    dto: CreateAgencyShopDto,
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

    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          dto.shopId,
        ),
      });

    if (!shop) {
      throw new NotFoundException(
        "Shop not found.",
      );
    }

    const [connection] =
      await db
        .insert(agencyShops)
        .values({
          agencyId: agency.id,
          shopId: shop.id,
          deliveryDay:
            dto.deliveryDay,
        })
        .returning();

    return {
      success: true,
      message:
        "Shop assigned successfully.",
      connection,
    };
  }

  // =====================================
  // Admin
  // =====================================

  async findAll() {
    return db.query.agencyShops.findMany();
  }

  // =====================================
  // Agency -> Connected Shops
  // =====================================

  async findByAgency(
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

    return db.query.agencyShops.findMany({
      where: eq(
        agencyShops.agencyId,
        agency.id,
      ),
    });
  }

  // =====================================
  // Shop -> Connected Agencies
  // =====================================

  async findByShop(
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

    return db.query.agencyShops.findMany({
      where: eq(
        agencyShops.shopId,
        shop.id,
      ),
    });
  }
}