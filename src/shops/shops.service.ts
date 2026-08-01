import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  shops,
  agencyShops,
  orders,
} from "../db/schema";

import { SubmitShopDocumentsDto } from "./dto/submit-shop-documents.dto";

@Injectable()
export class ShopsService {
  // =====================================
  // Submit Documents
  // =====================================

  async submit(
    dto: SubmitShopDocumentsDto,
  ) {
    console.log(dto);

    return {
      success: true,
      message:
        "Documents submitted successfully.",
    };
  }

  // =====================================
  // Shop Status
  // =====================================

  async status(id: string) {
    return {
      id,
      status: "PENDING",
      documents: {
        aadhaar: true,
        shopPhoto: true,
      },
    };
  }

  // =====================================
  // Dashboard (JWT)
  // =====================================

  async dashboard(
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

    const connectedAgencies =
      await db.query.agencyShops.findMany({
        where: eq(
          agencyShops.shopId,
          shop.id,
        ),
      });

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
        orderBy: (
          orders,
          { desc },
        ) => [
          desc(
            orders.createdAt,
          ),
        ],
      });

    return {
      success: true,

      shop,

      stats: {
        connectedAgencies:
          connectedAgencies.length,

        totalOrders:
          shopOrders.length,

        pendingOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "DELIVERED",
          ).length,
      },

      recentOrders:
        shopOrders.slice(
          0,
          5,
        ),
    };
  }
}