import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  shops,
  agencyShops,
  orders,
} from "../db/schema";

@Injectable()
export class ShopsService {
  async submit(dto: any) {
    console.log(dto);

    return {
      success: true,
      message:
        "Documents submitted successfully.",
    };
  }

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

  async dashboard(userId: string) {
    // Find shop using logged-in user id
    const shop = await db.query.shops.findFirst({
      where: eq(shops.userId, userId),
    });

    if (!shop) {
      return {
        success: false,
        message: "Shop not found",
      };
    }

    // Connected agencies
    const connectedAgencies =
      await db.query.agencyShops.findMany({
        where: eq(
          agencyShops.shopId,
          shop.id,
        ),
      });

    // Orders
    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
        orderBy: (
          orders,
          { desc },
        ) => [desc(orders.createdAt)],
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
            (o) => o.status === "PENDING",
          ).length,

        deliveredOrders:
          shopOrders.filter(
            (o) => o.status === "DELIVERED",
          ).length,
      },

      recentOrders:
        shopOrders.slice(0, 5),
    };
  }
}