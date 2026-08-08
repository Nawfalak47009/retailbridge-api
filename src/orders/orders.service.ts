import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  eq,
  and,
  count,
} from "drizzle-orm";

import { db } from "../db";
import {
  agencies,
  orders,
  shops,
  orderItems,
  products,
  rewardTransactions,
  agencyShopConnections,
  deliverySlots,
} from "../db/schema";

import { S3Service } from "../documents/s3.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

function getNextDayDate(dayName: string): Date {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const targetDay = days.findIndex(
    (day) =>
      day.toLowerCase() ===
      dayName.toLowerCase(),
  );

  if (targetDay === -1) {
    throw new Error(
      `Invalid delivery day: ${dayName}`,
    );
  }

  const now = new Date();
  const result = new Date(now);

  const currentDay = now.getDay();

  let difference =
    targetDay - currentDay;

  if (difference < 0) {
    difference += 7;
  }

  result.setDate(
    now.getDate() + difference,
  );

  return result;
}

function setSlotTime(
  date: Date,
  time: string,
): Date {
  const result = new Date(date);

  const parts = time
    .trim()
    .split(" ");

  const timePart = parts[0];
  const modifier =
    parts[1]?.toUpperCase();

  const [
    hoursString,
    minutesString,
  ] = timePart.split(":");

  let hours = Number(hoursString);

  const minutes =
    Number(minutesString || 0);

  if (
    modifier === "PM" &&
    hours < 12
  ) {
    hours += 12;
  }

  if (
    modifier === "AM" &&
    hours === 12
  ) {
    hours = 0;
  }

  result.setHours(
    hours,
    minutes,
    0,
    0,
  );

  return result;
}

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
  // ==========================================
  // FIND SHOP FROM LOGGED-IN USER
  // ==========================================

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

  // ==========================================
  // FIND AGENCY
  // ==========================================

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

  // ==========================================
  // CHECK SHOP ↔ AGENCY CONNECTION
  // ==========================================

  const connection =
    await db.query.agencyShopConnections.findFirst({
      where: and(
        eq(
          agencyShopConnections.agencyId,
          agency.id,
        ),
        eq(
          agencyShopConnections.shopId,
          shop.id,
        ),
      ),
    });

  if (!connection) {
    throw new UnauthorizedException(
      "Your shop is not connected to this agency.",
    );
  }
// ==========================================
// FIND NEXT AVAILABLE DELIVERY SLOT
// ==========================================

const availableSlots =
  await db
    .select()
    .from(deliverySlots)
    .where(
      and(
        eq(
          deliverySlots.agencyId,
          agency.id,
        ),
        eq(
          deliverySlots.shopId,
          shop.id,
        ),
        eq(
          deliverySlots.isActive,
          "true",
        ),
      ),
    );

if (availableSlots.length === 0) {
  throw new NotFoundException(
    "No delivery slots are available for this shop.",
  );
}

// ==========================================
// FIND EARLIEST AVAILABLE SLOT
// ==========================================

let selectedSlot:
  (typeof availableSlots)[number] | null =
  null;

let selectedDeliveryDate:
  Date | null = null;

let selectedBookedOrders = 0;

for (const candidate of availableSlots) {
  let deliveryDate =
    getNextDayDate(candidate.day);

  let scheduledDate =
    setSlotTime(
      deliveryDate,
      candidate.startTime,
    );

  // If today's slot has already started,
  // use next week's occurrence.
  if (
    scheduledDate.getTime() <=
    Date.now()
  ) {
    scheduledDate.setDate(
      scheduledDate.getDate() + 7,
    );
  }

  const bookedResult =
    await db
      .select({
        count: count(),
      })
      .from(orders)
      .where(
        and(
          eq(
            orders.slotId,
            candidate.id,
          ),
          eq(
            orders.agencyId,
            agency.id,
          ),
        ),
      );

  const bookedOrders =
    Number(
      bookedResult[0]?.count ?? 0,
    );

  if (
    bookedOrders >=
    candidate.maxOrders
  ) {
    continue;
  }

  if (
    !selectedDeliveryDate ||
    scheduledDate <
      selectedDeliveryDate
  ) {
    selectedSlot =
      candidate;

    selectedDeliveryDate =
      scheduledDate;

    selectedBookedOrders =
      bookedOrders;
  }
}

if (
  !selectedSlot ||
  !selectedDeliveryDate
) {
  throw new UnauthorizedException(
    "All upcoming delivery slots are fully booked.",
  );
}

  // ==========================================
  // CREATE ORDER
  // ==========================================

 const [order] =
  await db
    .insert(orders)
    .values({
      shopId: shop.id,
      agencyId: agency.id,
      slotId: selectedSlot.id,
      scheduledDate:
        selectedDeliveryDate,
      remarks: dto.remarks,
    })
    .returning();

  return {
    success: true,
    message:
      "Order placed successfully.",
    order,
    deliverySlot: {
  id: selectedSlot.id,

  day: selectedSlot.day,

  startTime:
    selectedSlot.startTime,

  endTime:
    selectedSlot.endTime,

  scheduledDate:
    selectedDeliveryDate,

  maxOrders:
    selectedSlot.maxOrders,

  bookedOrders:
    selectedBookedOrders + 1,

  remainingOrders:
    selectedSlot.maxOrders -
    (selectedBookedOrders + 1),
},
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
  shopName: shop.shopName,
  ownerName: shop.ownerName,
  phone: shop.phone,
  address: shop.address,
  pincode: shop.pincode,
},

      items:
        productsData,
    });
  }

  return response;
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

  const response: any[] = [];

  for (const order of shopOrders) {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          order.agencyId,
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

      const quantity = Number(item.cases);
      const price = Number(product.price);

      totalAmount += quantity * price;
      totalQuantity += quantity;

      productsData.push({
        id: product.id,
        name: product.name,
        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),
        quantity,
        price,
        subtotal: quantity * price,
        unit: product.unit,
        quantityPerUnit:
          product.quantityPerUnit,
      });
    }

    response.push({
      id: order.id,
      orderNumber:
        order.orderNumber,
      status: order.status,
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

      agency: agency && {
        id: agency.id,
        agencyName:
          agency.agencyName,
        ownerName:
          agency.ownerName,
        phone:
          agency.phone,
      },

      items: productsData,
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
  if (!order.scheduledDate) {
    throw new NotFoundException(
      "Delivery schedule is not assigned to this order.",
    );
  }

  updateData.scheduledDate =
    order.scheduledDate;
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
 // Reward shop once
if (
  dto.status === "DELIVERED" &&
  order.rewardPoints === 0
) {
  await db
    .insert(rewardTransactions)
    .values({
      shopId: order.shopId,
      orderId: order.id,
      points: 5,
      type: "EARN",
      description: "Order Delivered",
    });
}

  return {
    success: true,
    message:
      "Order updated successfully.",
    order: updated,
  };
}
}