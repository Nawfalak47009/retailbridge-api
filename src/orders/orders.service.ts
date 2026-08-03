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
  orderItems,
  products,
} from "../db/schema";

import { S3Service } from "../documents/s3.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}
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

  const agencyOrders =
    await db.query.orders.findMany({
      where: eq(
        orders.agencyId,
        agency.id,
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

  const response: any[] = [];

  for (const order of agencyOrders) {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          order.shopId,
        ),
      });

    const items =
      await db.query.orderItems.findMany({
        where: eq(
          orderItems.orderId,
          order.id,
        ),
      });

    const productsData: any[] = [];

    let totalAmount = 0;

    let totalQuantity = 0;

    for (const item of items) {
      const product =
        await db.query.products.findFirst({
          where: eq(
            products.id,
            item.productId,
          ),
        });

      if (!product) continue;

      let key = product.image;

      if (key.startsWith("http")) {
        key = key
          .split("?")[0]
          .split("/")
          .pop()!;
      }

      const quantity =
        Number(item.cases);

      const price =
        Number(product.price);

      totalAmount +=
        quantity * price;

      totalQuantity +=
        quantity;

      productsData.push({
        id: product.id,
        name: product.name,
        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),
        quantity,
        price,
        subtotal:
          quantity * price,
        unit:
          product.unit,
        quantityPerUnit:
          product.quantityPerUnit,
      });
    }

    response.push({
      id: order.id,
      orderNumber:
        order.orderNumber,
      status:
        order.status,
      createdAt:
        order.createdAt,
      remarks:
        order.remarks,

      totalAmount,
      totalQuantity,
      totalItems:
        productsData.length,

      rewardPoints:
        order.rewardPoints,

      deliveryPerson:
        order.deliveryPerson,

      deliveryPhone:
        order.deliveryPhone,

      trackingMessage:
        order.trackingMessage,

      scheduledDate:
        order.scheduledDate,

      shop: shop && {
        id: shop.id,
        shopName:
          shop.shopName,
        ownerName:
          shop.ownerName,
        phone:
          shop.phone,
        address:
          shop.address,
        pincode:
          shop.pincode,
        category:
          shop.category,
      },

      items:
        productsData,
    });
  }

  return response;
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

  // --------------------------
  // Authorization
  // --------------------------

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
      agency.id !== order.agencyId
    ) {
      throw new UnauthorizedException(
        "Unauthorized.",
      );
    }
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
      shop.id !== order.shopId
    ) {
      throw new UnauthorizedException(
        "Unauthorized.",
      );
    }
  }

  // --------------------------
  // Agency
  // --------------------------

  const agency =
    await db.query.agencies.findFirst({
      where: eq(
        agencies.id,
        order.agencyId,
      ),
    });

  // --------------------------
  // Shop
  // --------------------------

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        order.shopId,
      ),
    });

  // --------------------------
  // Items
  // --------------------------

  const items =
    await db.query.orderItems.findMany({
      where: eq(
        orderItems.orderId,
        order.id,
      ),
    });

  const productsData: any[] = [];

  let totalAmount = 0;

  let totalQuantity = 0;

  for (const item of items) {
    const product =
      await db.query.products.findFirst({
        where: eq(
          products.id,
          item.productId,
        ),
      });

    if (!product) continue;

    let key = product.image;

    if (key.startsWith("http")) {
      key = key
        .split("?")[0]
        .split("/")
        .pop()!;
    }

    const quantity =
      Number(item.cases);

    const price =
      Number(product.price);

    totalAmount +=
      quantity * price;

    totalQuantity +=
      quantity;

    productsData.push({
      id: product.id,

      name: product.name,

      image:
        await this.s3Service.getSignedImageUrl(
          key,
        ),

      quantity,

      price,

      subtotal:
        quantity * price,

      unit:
        product.unit,

      quantityPerUnit:
        product.quantityPerUnit,
    });
  }

  return {
    id: order.id,

    orderNumber:
      order.orderNumber,

    status:
      order.status,

    paymentStatus:
      order.paymentStatus,

    createdAt:
      order.createdAt,

    acceptedAt:
      order.acceptedAt,

    scheduledDate:
      order.scheduledDate,

    outForDeliveryAt:
      order.outForDeliveryAt,

    deliveredAt:
      order.deliveredAt,

    remarks:
      order.remarks,

    trackingMessage:
      order.trackingMessage,

    deliveryPerson:
      order.deliveryPerson,

    deliveryPhone:
      order.deliveryPhone,

    rewardPoints:
      order.rewardPoints,

    totalItems:
      productsData.length,

    totalQuantity,

    totalAmount,

    agency: agency && {
      id: agency.id,
      agencyName:
        agency.agencyName,
      ownerName:
        agency.ownerName,
      phone:
        agency.phone,
    },

    shop: shop && {
      id: shop.id,
      shopName:
        shop.shopName,
      ownerName:
        shop.ownerName,
      phone:
        shop.phone,
      address:
        shop.address,
      pincode:
        shop.pincode,
    },

    items: productsData,
  };
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