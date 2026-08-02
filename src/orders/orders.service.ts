import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  agencies,
  orders,
  shops,
} from "../db/schema";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  // ===========================
  // SHOP - CREATE ORDER
  // ===========================

  async create(
    userId: string,
    dto: CreateOrderDto,
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

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          dto.agencyId,
        ),
      });

    if (!agency) {
      throw new NotFoundException(
        "Agency not found.",
      );
    }

    const [order] =
      await db
        .insert(orders)
        .values({
          shopId: shop.id,
          agencyId: agency.id,
          remarks: dto.remarks,
        })
        .returning();

    return {
      success: true,
      message: "Order placed successfully.",
      order,
    };
  }

  // ===========================
  // ADMIN - ALL ORDERS
  // ===========================

  async findAll() {
    return db.query.orders.findMany({
      orderBy: (orders, { desc }) => [
        desc(orders.createdAt),
      ],
    });
  }

  // ===========================
  // AGENCY - MY ORDERS
  // ===========================

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

    return db.query.orders.findMany({
      where: eq(
        orders.agencyId,
        agency.id,
      ),
      orderBy: (orders, { desc }) => [
        desc(orders.createdAt),
      ],
    });
  }

  // ===========================
  // SHOP - MY ORDERS
  // ===========================

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

    return db.query.orders.findMany({
      where: eq(
        orders.shopId,
        shop.id,
      ),
      orderBy: (orders, { desc }) => [
        desc(orders.createdAt),
      ],
    });
  }

  // ===========================
  // GET SINGLE ORDER
  // ===========================

 async findOne(
  userId: string,
  role: string,
  id: string,
) {
  const order =
    await db.query.orders.findFirst({
      where: eq(
        orders.id,
        id,
      ),
    });

  if (!order) {
    throw new NotFoundException(
      "Order not found.",
    );
  }

  if (role === "ADMIN") {
    return order;
  }

  if (role === "AGENCY") {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          userId,
        ),
      });

    if (
      !agency ||
      order.agencyId !== agency.id
    ) {
      throw new UnauthorizedException(
        "Unauthorized.",
      );
    }

    return order;
  }

  if (role === "SHOP") {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          userId,
        ),
      });

    if (
      !shop ||
      order.shopId !== shop.id
    ) {
      throw new UnauthorizedException(
        "Unauthorized.",
      );
    }

    return order;
  }

  throw new UnauthorizedException(
    "Unauthorized.",
  );
}

  // ===========================
  // AGENCY - UPDATE STATUS
  // ===========================

 async updateStatus(
  userId: string,
  id: string,
  dto: UpdateOrderDto,
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

  const order =
    await db.query.orders.findFirst({
      where: eq(
        orders.id,
        id,
      ),
    });

  if (!order) {
    throw new NotFoundException(
      "Order not found.",
    );
  }

  if (order.agencyId !== agency.id) {
    throw new UnauthorizedException(
      "You cannot update this order.",
    );
  }

  const updateData: Partial<
    typeof orders.$inferInsert
  > = {
    status: dto.status,
    deliveryPerson:
      dto.deliveryPerson,
    deliveryPhone:
      dto.deliveryPhone,
    trackingMessage:
      dto.trackingMessage,
  };

  if (
    dto.status === "ACCEPTED"
  ) {
    updateData.acceptedAt =
      new Date();
  }

  if (
    dto.status === "SCHEDULED"
  ) {
    updateData.scheduledDate =
      dto.scheduledDate
        ? new Date(
            dto.scheduledDate,
          )
        : null;
  }

  if (
    dto.status ===
    "OUT_FOR_DELIVERY"
  ) {
    updateData.outForDeliveryAt =
      new Date();
  }

  if (
    dto.status ===
    "DELIVERED"
  ) {
    updateData.deliveredAt =
      new Date();

    updateData.rewardPoints = 5;
  }

  const [updated] =
    await db
      .update(orders)
      .set(updateData)
      .where(
        eq(
          orders.id,
          id,
        ),
      )
      .returning();

  // Reward shop once
  if (
    dto.status ===
      "DELIVERED" &&
    order.rewardPoints === 0
  ) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          order.shopId,
        ),
      });

    if (shop) {
      await db
        .update(shops)
        .set({
          rewardPoints:
            shop.rewardPoints + 5,
        })
        .where(
          eq(
            shops.id,
            shop.id,
          ),
        );
    }
  }

  return {
    success: true,
    message:
      "Order updated successfully.",
    order: updated,
  };
}
}