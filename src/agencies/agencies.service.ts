import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  agencies,
  agencyProfiles,
  users,
  products,
} from "../db/schema";

@Injectable()
export class AgenciesService {
  // ==========================================
  // ALL APPROVED AGENCIES
  // ==========================================

  async findAll() {
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
  categories: string[];
}[] = [];

    for (const agency of agencyList) {
      const user =
        await db.query.users.findFirst({
          where: eq(
            users.id,
            agency.userId,
          ),
        });

      // Only approved agencies
      if (
        !user ||
        user.status !== "APPROVED"
      ) {
        continue;
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

      const categories = [
        ...new Set(
          productList.map(
            (product) =>
              product.category,
          ),
        ),
      ];

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
          profile?.logo ?? "",

        description:
          profile?.description ?? "",

        productCount:
          productList.length,

        categories,
      });
    }

    return result;
  }

  // ==========================================
  // SINGLE AGENCY
  // ==========================================

  async findOne(id: string) {
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

        categories,
      },
    };
  }
}