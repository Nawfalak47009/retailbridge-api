import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  shops,
  agencies,
  orders,
  orderItems,
  products,
  agencyShopConnections,
} from "../db/schema";

import { SubmitShopDocumentsDto } from "./dto/submit-shop-documents.dto";

import { S3Service } from "../documents/s3.service";

@Injectable()
export class ShopsService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

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

  async profile(
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

    // ===================================
    // CONNECTED AGENCIES
    // ===================================

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.shopId,
          shop.id,
        ),
      });

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
      });

    const deliveredOrdersCount =
      shopOrders.filter(
        (order) =>
          order.status ===
          "DELIVERED",
      ).length;

    // 5 points / coins per successfully delivered order from DB
    const realRewardPoints =
      deliveredOrdersCount * 5;

    return {
      success: true,

      shop: {
        ...shop,
        rewardPoints: realRewardPoints,
        walletBalance: 0,
      },

      stats: {
        connectedAgencies:
          connections.length,

        totalOrders:
          shopOrders.length,

        pendingOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          deliveredOrdersCount,

        rewardPoints:
          realRewardPoints,

        pointsPerOrder: 5,
      },
    };
  }

  // =====================================
  // Update Address & Store Details
  // =====================================

  async updateAddress(
    userId: string,
    body: {
      address?: string;
      pincode?: string;
      shopName?: string;
      ownerName?: string;
      phone?: string;
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

    const updateFields: any = {};
    if (body.address !== undefined) updateFields.address = body.address.trim();
    if (body.pincode !== undefined) updateFields.pincode = body.pincode.trim();
    if (body.shopName !== undefined && body.shopName.trim()) updateFields.shopName = body.shopName.trim();
    if (body.ownerName !== undefined && body.ownerName.trim()) updateFields.ownerName = body.ownerName.trim();
    if (body.phone !== undefined && body.phone.trim()) updateFields.phone = body.phone.trim();

    const [updated] =
      await db
        .update(shops)
        .set(updateFields)
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
        "Store details and delivery address updated successfully.",
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

    // ===================================
    // TOTAL AGENCIES
    // ===================================

    const allAgencies =
      await db.query.agencies.findMany();

    // ===================================
    // CONNECTED AGENCIES
    // ===================================

    const connections =
      await db.query.agencyShopConnections.findMany({
        where: eq(
          agencyShopConnections.shopId,
          shop.id,
        ),
      });

    // ===================================
    // ORDERS
    // ===================================

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

    const deliveredOrdersCount =
      shopOrders.filter(
        (order) =>
          order.status ===
          "DELIVERED",
      ).length;

    // 5 points / coins per successfully delivered order from DB
    const realRewardPoints =
      deliveredOrdersCount * 5;

    return {
      success: true,

      shop: {
        ...shop,
        rewardPoints: realRewardPoints,
      },

      stats: {
        // =================================
        // AGENCY STATISTICS
        // =================================

        // All agencies registered
        // in the system
        totalAgencies:
          allAgencies.length,

        // Agencies connected
        // to this shop
        connectedAgencies:
          connections.length,

        // =================================
        // ORDER STATISTICS
        // =================================

        totalOrders:
          shopOrders.length,

        pendingOrders:
          shopOrders.filter(
            (order) =>
              order.status ===
              "PENDING",
          ).length,

        deliveredOrders:
          deliveredOrdersCount,

        rewardPoints:
          realRewardPoints,

        pointsPerOrder: 5,
      },

      // =================================
      // RECENT ORDERS
      // =================================

      recentOrders:
        shopOrders.slice(
          0,
          5,
        ),
    };
  }

  // =====================================
  // FREQUENTLY BOUGHT
  // =====================================

  async frequentlyBought(
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

    const shopOrders =
      await db.query.orders.findMany({
        where: eq(
          orders.shopId,
          shop.id,
        ),
      });

    const frequency =
      new Map<
        string,
        {
          orderedCount: number;
          lastOrdered: Date;
        }
      >();

    for (
      const order of shopOrders
    ) {
      const items =
        await db.query.orderItems.findMany({
          where: eq(
            orderItems.orderId,
            order.id,
          ),
        });

      for (
        const item of items
      ) {
        const existing =
          frequency.get(
            item.productId,
          );

        if (existing) {
          existing.orderedCount +=
            Number(
              item.cases,
            );

          if (
            order.createdAt >
            existing.lastOrdered
          ) {
            existing.lastOrdered =
              order.createdAt;
          }
        } else {
          frequency.set(
            item.productId,
            {
              orderedCount:
                Number(
                  item.cases,
                ),

              lastOrdered:
                order.createdAt,
            },
          );
        }
      }
    }

    const result: any[] = [];

    for (
      const [
        productId,
        stats,
      ] of frequency.entries()
    ) {
      const product =
        await db.query.products.findFirst({
          where: eq(
            products.id,
            productId,
          ),
        });

      if (!product) {
        continue;
      }

      let key =
        product.image;

      if (
        key.startsWith("http")
      ) {
        key = key
          .split("?")[0]
          .split("/")
          .pop()!;
      }

      result.push({
        id: product.id,

        name:
          product.name,

        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),

        unit:
          product.unit,

        quantityPerUnit:
          product.quantityPerUnit,

        price:
          Number(
            product.price,
          ),

        orderedCount:
          stats.orderedCount,

        lastOrdered:
          stats.lastOrdered,
      });
    }

    result.sort(
      (a, b) =>
        b.orderedCount -
        a.orderedCount,
    );

    return result.slice(
      0,
      10,
    );
  }
}