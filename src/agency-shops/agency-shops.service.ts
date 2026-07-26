import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { agencyShops } from "../db/schema";

import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";

@Injectable()
export class AgencyShopsService {
  async create(
    dto: CreateAgencyShopDto,
  ) {
    const [shop] = await db
      .insert(agencyShops)
      .values(dto)
      .returning();

    return {
      success: true,
      message: "Shop assigned successfully.",
      shop,
    };
  }

  async findAll() {
    return db.query.agencyShops.findMany();
  }

  async findByAgency(
    agencyId: string,
  ) {
    return db.query.agencyShops.findMany({
      where: eq(
        agencyShops.agencyId,
        agencyId,
      ),
    });
  }
}