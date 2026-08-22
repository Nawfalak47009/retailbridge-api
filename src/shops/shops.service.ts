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

    return {
      success: true,

      shop,

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
          address:
            body.address,

          pincode:
            body.pincode,
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

    return {
      success: true,

      shop,

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