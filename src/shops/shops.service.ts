import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  shops,
  agencyShops,
  agencies,
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
// Shop Profile
// =====================================

async profile(userId: string) {
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

   const allAgencies =
  await db.query.agencies.findMany();

  const shopOrders =
    await db.query.orders.findMany({
      where: eq(
        orders.shopId,
        shop.id,
      ),
    });

  return {
    success: true,

    shop,

   stats: {
  totalAgencies:
    allAgencies.length,

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
  };
}
// =====================================
// Update Address
// =====================================

async updateAddress(
  userId: string,
  body: {
    address: string;
    pincode: string;
    landmark?: string;
  },
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

  const [updated] =
    await db
      .update(shops)
      .set({
        address: body.address,
        pincode: body.pincode,
      })
      .where(
        eq(
          shops.id,
          shop.id,
        ),
      )
      .returning();

  return {
    success: true,
    message:
      "Address updated successfully.",
    shop: updated,
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

      const allAgencies =
  await db.query.agencies.findMany();

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
  totalAgencies:
    allAgencies.length,

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

