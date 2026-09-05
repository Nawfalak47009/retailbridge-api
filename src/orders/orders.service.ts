import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import {
  eq,
  and,
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
  agencyShopRequests,
  deliverySlots,
} from "../db/schema";

import { S3Service } from "../documents/s3.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { calculateNextDeliveryDate } from "../delivery-slots/delivery-slots.utils";

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
    // FIND SHOP
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
    // CHECK IF CONNECTION WAS REJECTED
    // ==========================================

    const rejectedRequest =
      await db.query.agencyShopRequests.findFirst({
        where: and(
          eq(
            agencyShopRequests.agencyId,
            agency.id,
          ),
          eq(
            agencyShopRequests.shopId,
            shop.id,
          ),
          eq(
            agencyShopRequests.status,
            "REJECTED",
          ),
        ),
      });

    if (rejectedRequest) {
      throw new UnauthorizedException(
        `Your connection request was declined by ${agency.agencyName}. You cannot place orders with this agency.`,
      );
    }

    // Automatically send a Connection Request if not already connected and no pending request exists
    const existingConnection =
      await db.query.agencyShopConnections.findFirst({
        where: and(
          eq(agencyShopConnections.agencyId, agency.id),
          eq(agencyShopConnections.shopId, shop.id),
        ),
      });

    if (!existingConnection) {
      const existingReq =
        await db.query.agencyShopRequests.findFirst({
          where: and(
            eq(agencyShopRequests.agencyId, agency.id),
            eq(agencyShopRequests.shopId, shop.id),
            eq(agencyShopRequests.status, "PENDING"),
          ),
        });

      if (!existingReq) {
        try {
          await db.insert(agencyShopRequests).values({
            agencyId: agency.id,
            shopId: shop.id,
            requestedBy: "SHOP",
            status: "PENDING",
          });
        } catch (reqErr) {
          console.log("Auto connection request on order create note:", reqErr);
        }
      }
    }

    // ==========================================
    // FIND ACTIVE DELIVERY DAYS
    // ==========================================

    const availableDeliveryDays =
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

    // ==========================================
    // FIND NEXT APPLICABLE DELIVERY DATE
    // ==========================================

    let selectedDeliveryDay:
      (typeof availableDeliveryDays)[number] |
      null = null;

    let selectedDeliveryDate:
      Date | null = null;

    if (
      availableDeliveryDays.length >
      0
    ) {
      const now =
        new Date();
      now.setHours(
        0,
        0,
        0,
        0,
      );

      for (
        const candidate of availableDeliveryDays
      ) {
        const candidateDate =
          calculateNextDeliveryDate(
            candidate,
            now,
          );

        if (
          !selectedDeliveryDate ||
          candidateDate.getTime() <
            selectedDeliveryDate.getTime()
        ) {
          selectedDeliveryDay =
            candidate;

          selectedDeliveryDate =
            candidateDate;
        }
      }
    }

    // ==========================================
    // CREATE ORDER
    // ==========================================

    const [order] =
      await db
        .insert(orders)
        .values({
          shopId:
            shop.id,

          agencyId:
            agency.id,

          // Temporary legacy compatibility.
          // This can be removed after the
          // slotId migration is completed.
          slotId:
            selectedDeliveryDay?.id ??
            null,

          scheduledDate:
            selectedDeliveryDate,

          status:
            selectedDeliveryDay
              ? "SCHEDULED"
              : "DELIVERY_SCHEDULE_PENDING",

          remarks:
            dto.remarks,
        })
        .returning();

    // ==========================================
    // RESPONSE
    // ==========================================

    return {
      success: true,

      message:
        selectedDeliveryDay
          ? "Order placed successfully. Delivery has been scheduled."
          : "Order placed successfully. Delivery day is pending from the agency.",

      order,

      deliveryDay:
        selectedDeliveryDay
          ? {
              id:
                selectedDeliveryDay.id,

              day:
                selectedDeliveryDay.day,

              deliveryDate:
                selectedDeliveryDay.deliveryDate,

              scheduledDate:
                selectedDeliveryDate,
            }
          : null,
    };
  }

  // ===========================
  // ADMIN - ALL ORDERS
  // ===========================

  async findAll() {
    return db.query.orders.findMany({
      orderBy: (
        orders,
        { desc },
      ) => [
        desc(
          orders.createdAt,
        ),
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

    for (
      const order of agencyOrders
    ) {
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
      let totalGstAmount = 0;

      for (
        const item of items
      ) {
        const product =
          await db.query.products.findFirst({
            where: eq(
              products.id,
              item.productId,
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

        const cases =
          Number(item.cases) || 0;
        const loose =
          Number(item.extraQuantity) || 0;
        const unitsPerCase =
          parseInt(product.quantityPerUnit, 10) || 1;
        const totalUnits =
          (cases * unitsPerCase) + loose;

        const pricePerCase =
          Number(product.price) || 0;
        const pricePerUnit =
          product.loosePrice && Number(product.loosePrice) > 0
            ? Number(product.loosePrice)
            : unitsPerCase > 1
            ? Number((pricePerCase / unitsPerCase).toFixed(2))
            : pricePerCase;

        const gstPercent = Math.max(
          0,
          parseFloat((product as any).gstPercent || "0") || 0,
        );
        const caseGstAmount = (pricePerCase * gstPercent) / 100;
        const totalCaseGst = cases * caseGstAmount;
        const casesSubtotal = Math.round(cases * (pricePerCase + caseGstAmount));
        const looseSubtotal = Math.round(loose * pricePerUnit); // Strictly 0% GST on loose
        const itemSubtotal = casesSubtotal + looseSubtotal;

        totalAmount +=
          itemSubtotal;

        totalQuantity +=
          totalUnits;

        totalGstAmount +=
          totalCaseGst;

        let packBreakdown = "";
        if (cases > 0 && loose > 0) {
          packBreakdown = `${cases} Case${cases > 1 ? "s" : ""} + ${loose} Loose`;
        } else if (cases > 0) {
          packBreakdown = `${cases} Case${cases > 1 ? "s" : ""}`;
        } else if (loose > 0) {
          packBreakdown = `${loose} Loose`;
        } else {
          packBreakdown = `${cases} Cases`;
        }

        productsData.push({
          id:
            product.id,

          name:
            product.name,

          image:
            await this.s3Service.getSignedImageUrl(
              key,
            ),

          quantity: totalUnits,
          cases,
          extraQuantity: loose,
          loose,
          unitsPerCase,

          price: pricePerCase,
          pricePerCase,
          pricePerUnit,
          loosePrice: product.loosePrice,
          gstPercent: (product as any).gstPercent || "0",
          caseGstAmount: Number(caseGstAmount.toFixed(2)),
          totalCaseGst: Number(totalCaseGst.toFixed(2)),
          pricePerCaseWithGst: Number((pricePerCase + caseGstAmount).toFixed(2)),

          subtotal:
            itemSubtotal,

          packBreakdown,

          unit:
            product.unit,

          quantityPerUnit:
            product.quantityPerUnit,
        });
      }

      // ========================================
      // FIND DELIVERY DAY FOR THIS ORDER
      // ========================================

      let deliveryDay:
        typeof deliverySlots.$inferSelect |
        undefined = undefined;

      if (order.slotId) {
        deliveryDay =
          await db.query.deliverySlots.findFirst({
            where: and(
              eq(
                deliverySlots.id,
                order.slotId,
              ),
              eq(
                deliverySlots.agencyId,
                order.agencyId,
              ),
              eq(
                deliverySlots.shopId,
                order.shopId,
              ),
            ),
          });
      }

      if (!deliveryDay) {
        deliveryDay = await db.query.deliverySlots.findFirst({
          where: and(
            eq(deliverySlots.agencyId, order.agencyId),
            eq(deliverySlots.shopId, order.shopId),
            eq(deliverySlots.isActive, "true"),
          ),
          orderBy: (s, { desc }) => [desc(s.createdAt)],
        });
      }

      let effectiveScheduledDate = order.scheduledDate;
      if (!effectiveScheduledDate && deliveryDay) {
        effectiveScheduledDate = calculateNextDeliveryDate(
          deliveryDay,
          order.createdAt ? new Date(order.createdAt) : new Date(),
        );
      } else if (
        effectiveScheduledDate &&
        order.createdAt &&
        order.status !== "DELIVERED" &&
        order.status !== "CANCELLED"
      ) {
        const schedTime = new Date(effectiveScheduledDate).setHours(0, 0, 0, 0);
        const createdTime = new Date(order.createdAt).setHours(0, 0, 0, 0);
        if (schedTime < createdTime && deliveryDay) {
          effectiveScheduledDate = calculateNextDeliveryDate(
            deliveryDay,
            new Date(order.createdAt),
          );
        }
      }

      response.push({
        id:
          order.id,

        orderNumber:
          order.orderNumber,

        shopId:
          order.shopId,

        agencyId:
          order.agencyId,

        slotId:
          order.slotId,

        status:
          order.status,

        createdAt:
          order.createdAt,

        remarks:
          order.remarks,

        totalAmount:
          totalAmount > 0 ? totalAmount : Number(order.totalAmount || 0),

        totalGstAmount:
          Math.round(totalGstAmount),

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
          effectiveScheduledDate,

        deliveryDay:
          deliveryDay
            ? {
                id:
                  deliveryDay.id,

                day:
                  deliveryDay.day,

                deliveryDate:
                  effectiveScheduledDate || deliveryDay.deliveryDate,
              }
            : null,

        shop:
          shop && {
            id:
              shop.id,

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

        items:
          productsData,

        products:
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

    for (
      const order of shopOrders
    ) {
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
      let totalGstAmount = 0;

      for (
        const item of items
      ) {
        const product =
          await db.query.products.findFirst({
            where: eq(
              products.id,
              item.productId,
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

        const cases =
          Number(item.cases) || 0;
        const loose =
          Number(item.extraQuantity) || 0;
        const unitsPerCase =
          parseInt(product.quantityPerUnit, 10) || 1;
        const totalUnits =
          (cases * unitsPerCase) + loose;

        const pricePerCase =
          Number(product.price) || 0;
        const pricePerUnit =
          product.loosePrice && Number(product.loosePrice) > 0
            ? Number(product.loosePrice)
            : unitsPerCase > 1
            ? Number((pricePerCase / unitsPerCase).toFixed(2))
            : pricePerCase;

        const gstPercent = Math.max(
          0,
          parseFloat((product as any).gstPercent || "0") || 0,
        );
        const caseGstAmount = (pricePerCase * gstPercent) / 100;
        const totalCaseGst = cases * caseGstAmount;
        const casesSubtotal = Math.round(cases * (pricePerCase + caseGstAmount));
        const looseSubtotal = Math.round(loose * pricePerUnit); // Strictly 0% GST on loose
        const itemSubtotal = casesSubtotal + looseSubtotal;

        totalAmount +=
          itemSubtotal;

        totalQuantity +=
          totalUnits;

        totalGstAmount +=
          totalCaseGst;

        let packBreakdown = "";
        if (cases > 0 && loose > 0) {
          packBreakdown = `${cases} Case${cases > 1 ? "s" : ""} + ${loose} Loose`;
        } else if (cases > 0) {
          packBreakdown = `${cases} Case${cases > 1 ? "s" : ""}`;
        } else if (loose > 0) {
          packBreakdown = `${loose} Loose`;
        } else {
          packBreakdown = `${cases} Cases`;
        }

        productsData.push({
          id:
            product.id,

          name:
            product.name,

          image:
            await this.s3Service.getSignedImageUrl(
              key,
            ),

          quantity: totalUnits,
          cases,
          extraQuantity: loose,
          loose,
          unitsPerCase,

          price: pricePerCase,
          pricePerCase,
          pricePerUnit,
          loosePrice: product.loosePrice,
          gstPercent: (product as any).gstPercent || "0",
          caseGstAmount: Number(caseGstAmount.toFixed(2)),
          totalCaseGst: Number(totalCaseGst.toFixed(2)),
          pricePerCaseWithGst: Number((pricePerCase + caseGstAmount).toFixed(2)),

          subtotal:
            itemSubtotal,

          packBreakdown,

          unit:
            product.unit,

          quantityPerUnit:
            product.quantityPerUnit,
        });
      }

      // ========================================
      // FIND DELIVERY DAY
      // ========================================

      let deliveryDay:
  typeof deliverySlots.$inferSelect |
  undefined = undefined;

if (order.slotId) {
  deliveryDay =
    await db.query.deliverySlots.findFirst({
      where: and(
        eq(
          deliverySlots.id,
          order.slotId,
        ),
        eq(
          deliverySlots.agencyId,
          order.agencyId,
        ),
        eq(
          deliverySlots.shopId,
          order.shopId,
        ),
      ),
    });
}

if (!deliveryDay) {
  deliveryDay = await db.query.deliverySlots.findFirst({
    where: and(
      eq(deliverySlots.agencyId, order.agencyId),
      eq(deliverySlots.shopId, order.shopId),
      eq(deliverySlots.isActive, "true"),
    ),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}

let effectiveScheduledDate = order.scheduledDate;
if (!effectiveScheduledDate && deliveryDay) {
  effectiveScheduledDate = calculateNextDeliveryDate(
    deliveryDay,
    order.createdAt ? new Date(order.createdAt) : new Date(),
  );
} else if (
  effectiveScheduledDate &&
  order.createdAt &&
  order.status !== "DELIVERED" &&
  order.status !== "CANCELLED"
) {
  const schedTime = new Date(effectiveScheduledDate).setHours(0, 0, 0, 0);
  const createdTime = new Date(order.createdAt).setHours(0, 0, 0, 0);
  if (schedTime < createdTime && deliveryDay) {
    effectiveScheduledDate = calculateNextDeliveryDate(
      deliveryDay,
      new Date(order.createdAt),
    );
  }
}

      response.push({
        id:
          order.id,

        shopId:
          order.shopId,

        agencyId:
          order.agencyId,

        orderNumber:
          order.orderNumber,

        status:
          order.status,

        createdAt:
          order.createdAt,

        remarks:
          order.remarks,

        totalAmount,

        totalGstAmount:
          Math.round(totalGstAmount),

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
          effectiveScheduledDate,

        deliveryDay:
          deliveryDay
            ? {
                id:
                  deliveryDay.id,

                day:
                  deliveryDay.day,

                deliveryDate:
                  effectiveScheduledDate || deliveryDay.deliveryDate,
              }
            : null,

        agency:
          agency && {
            id:
              agency.id,

            agencyName:
              agency.agencyName,

            ownerName:
              agency.ownerName,

            phone:
              agency.phone,
          },

        items:
          productsData,
      });
    }

    return response;
  }

  // ===========================
  // SHOP - ORDERS FROM SPECIFIC AGENCY
  // ===========================

  async findByShopAndAgency(
    userId: string,
    agencyId: string,
  ) {
    const allOrders = await this.findByShop(userId);
    const agencyOrders = allOrders.filter(
      (ord: any) =>
        ord.agencyId === agencyId || ord.agency?.id === agencyId,
    );
    // Return only the single latest order for this agency
    return agencyOrders.length > 0 ? [agencyOrders[0]] : [];
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

    // ==========================================
    // AUTHORIZATION
    // ==========================================

    if (
      role === "AGENCY"
    ) {
      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.userId,
            userId,
          ),
        });

      if (
        !agency ||
        agency.id !==
          order.agencyId
      ) {
        throw new UnauthorizedException(
          "Unauthorized.",
        );
      }
    }

    if (
      role === "SHOP"
    ) {
      const shop =
        await db.query.shops.findFirst({
          where: eq(
            shops.userId,
            userId,
          ),
        });

      if (
        !shop ||
        shop.id !==
          order.shopId
      ) {
        throw new UnauthorizedException(
          "Unauthorized.",
        );
      }
    }

    // ==========================================
    // AGENCY
    // ==========================================

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          order.agencyId,
        ),
      });

    // ==========================================
    // SHOP
    // ==========================================

    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.id,
          order.shopId,
        ),
      });

    // ==========================================
    // ITEMS
    // ==========================================

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
    let totalGstAmount = 0;

    for (
      const item of items
    ) {
      const product =
        await db.query.products.findFirst({
          where: eq(
            products.id,
            item.productId,
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

      const cases =
        Number(item.cases) || 0;
      const loose =
        Number(item.extraQuantity) || 0;
      const unitsPerCase =
        parseInt(product.quantityPerUnit, 10) || 1;
      const totalUnits =
        (cases * unitsPerCase) + loose;

      const pricePerCase =
        Number(product.price) || 0;
      const pricePerUnit =
        product.loosePrice && Number(product.loosePrice) > 0
          ? Number(product.loosePrice)
          : unitsPerCase > 1
          ? Number((pricePerCase / unitsPerCase).toFixed(2))
          : pricePerCase;

      const gstPercent = Math.max(
        0,
        parseFloat((product as any).gstPercent || "0") || 0,
      );
      const caseGstAmount = (pricePerCase * gstPercent) / 100;
      const totalCaseGst = cases * caseGstAmount;
      const casesSubtotal = Math.round(cases * (pricePerCase + caseGstAmount));
      const looseSubtotal = Math.round(loose * pricePerUnit); // Strictly 0% GST on loose
      const itemSubtotal = casesSubtotal + looseSubtotal;

      totalAmount +=
        itemSubtotal;

      totalQuantity +=
        totalUnits;

      totalGstAmount +=
        totalCaseGst;

      let packBreakdown = "";
      if (cases > 0 && loose > 0) {
        packBreakdown = `${cases} Case${cases > 1 ? "s" : ""} + ${loose} Loose`;
      } else if (cases > 0) {
        packBreakdown = `${cases} Case${cases > 1 ? "s" : ""}`;
      } else if (loose > 0) {
        packBreakdown = `${loose} Loose`;
      } else {
        packBreakdown = `${cases} Cases`;
      }

      productsData.push({
        id:
          product.id,

        name:
          product.name,

        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),

        quantity: totalUnits,
        cases,
        extraQuantity: loose,
        loose,
        unitsPerCase,

        price: pricePerCase,
        pricePerCase,
        pricePerUnit,
        loosePrice: product.loosePrice,
        gstPercent: (product as any).gstPercent || "0",
        caseGstAmount: Number(caseGstAmount.toFixed(2)),
        totalCaseGst: Number(totalCaseGst.toFixed(2)),
        pricePerCaseWithGst: Number((pricePerCase + caseGstAmount).toFixed(2)),

        subtotal:
          itemSubtotal,

        packBreakdown,

        unit:
          product.unit,

        quantityPerUnit:
          product.quantityPerUnit,
      });
    }

    // ==========================================
    // DELIVERY DAY
    // ==========================================

    let deliveryDay:
  typeof deliverySlots.$inferSelect |
  undefined = undefined;

if (order.slotId) {
  deliveryDay =
    await db.query.deliverySlots.findFirst({
      where: and(
        eq(
          deliverySlots.id,
          order.slotId,
        ),
        eq(
          deliverySlots.agencyId,
          order.agencyId,
        ),
        eq(
          deliverySlots.shopId,
          order.shopId,
        ),
      ),
    });
}

if (!deliveryDay) {
  deliveryDay = await db.query.deliverySlots.findFirst({
    where: and(
      eq(deliverySlots.agencyId, order.agencyId),
      eq(deliverySlots.shopId, order.shopId),
      eq(deliverySlots.isActive, "true"),
    ),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });
}

let effectiveScheduledDate = order.scheduledDate;
if (!effectiveScheduledDate && deliveryDay) {
  effectiveScheduledDate = calculateNextDeliveryDate(
    deliveryDay,
    order.createdAt ? new Date(order.createdAt) : new Date(),
  );
} else if (
  effectiveScheduledDate &&
  order.createdAt &&
  order.status !== "DELIVERED" &&
  order.status !== "CANCELLED"
) {
  const schedTime = new Date(effectiveScheduledDate).setHours(0, 0, 0, 0);
  const createdTime = new Date(order.createdAt).setHours(0, 0, 0, 0);
  if (schedTime < createdTime && deliveryDay) {
    effectiveScheduledDate = calculateNextDeliveryDate(
      deliveryDay,
      new Date(order.createdAt),
    );
  }
}

    return {
      id:
        order.id,

      orderNumber:
        order.orderNumber,

      shopId:
        order.shopId,

      agencyId:
        order.agencyId,

      slotId:
        order.slotId,

      status:
        order.status,

      paymentStatus:
        order.paymentStatus,

      createdAt:
        order.createdAt,

      acceptedAt:
        order.acceptedAt,

      scheduledDate:
        effectiveScheduledDate,

      deliveryDay:
        deliveryDay
          ? {
              id:
                deliveryDay.id,

              day:
                deliveryDay.day,

              deliveryDate:
                effectiveScheduledDate || deliveryDay.deliveryDate,
            }
          : null,

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

      totalAmount:
        totalAmount > 0 ? totalAmount : Number(order.totalAmount || 0),

      totalGstAmount:
        Math.round(totalGstAmount),

      agency:
        agency && {
          id:
            agency.id,

          agencyName:
            agency.agencyName,

          ownerName:
            agency.ownerName,

          phone:
            agency.phone,
        },

      shop:
        shop && {
          id:
            shop.id,

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

      items:
        productsData,

      products:
        productsData,
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
    // ==========================================
    // FIND AGENCY
    // ==========================================

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

    // ==========================================
    // FIND ORDER
    // ==========================================

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

    // ==========================================
    // VERIFY ORDER BELONGS TO AGENCY
    // ==========================================

    if (
      order.agencyId !==
      agency.id
    ) {
      throw new UnauthorizedException(
        "You cannot update this order.",
      );
    }

    // ==========================================
    // UPDATE DATA
    // ==========================================

    const updateData: Partial<
      typeof orders.$inferInsert
    > = {
      status:
        dto.status,

      deliveryPerson:
        dto.deliveryPerson,

      deliveryPhone:
        dto.deliveryPhone,

      trackingMessage:
        dto.trackingMessage,
    };

    // ==========================================
    // ACCEPTED
    // ==========================================

    if (
      dto.status ===
      "ACCEPTED"
    ) {
      updateData.acceptedAt =
        new Date();
    }

    // ==========================================
    // ASSIGN DELIVERY DAY
    // ==========================================

    if (
      dto.status ===
      "SCHEDULED"
    ) {
      // ----------------------------------------
      // Temporary compatibility:
      // mobile currently sends slotId.
      // ----------------------------------------

      if (!dto.slotId) {
        throw new NotFoundException(
          "Please select a delivery day.",
        );
      }

      // ----------------------------------------
      // FIND SELECTED DELIVERY DAY
      // ----------------------------------------

      const deliveryDay =
        await db.query.deliverySlots.findFirst({
          where: and(
            eq(
              deliverySlots.id,
              dto.slotId,
            ),
            eq(
              deliverySlots.agencyId,
              agency.id,
            ),
            eq(
              deliverySlots.shopId,
              order.shopId,
            ),
            eq(
              deliverySlots.isActive,
              "true",
            ),
          ),
        });

      if (!deliveryDay) {
        throw new NotFoundException(
          "This delivery day is not available for this shop.",
        );
      }

      // ----------------------------------------
      // USE THE ASSIGNED DELIVERY DATE
      // DIRECTLY.
      // ----------------------------------------

      const scheduledDate =
        new Date(
          deliveryDay.deliveryDate,
        );

      if (
        Number.isNaN(
          scheduledDate.getTime(),
        )
      ) {
        throw new NotFoundException(
          "The selected delivery day has an invalid delivery date.",
        );
      }

      scheduledDate.setHours(
        0,
        0,
        0,
        0,
      );

      // ----------------------------------------
      // SAVE DELIVERY DAY
      // ----------------------------------------

      updateData.slotId =
        deliveryDay.id;

      updateData.scheduledDate =
        scheduledDate;
    }

    // ==========================================
    // OUT FOR DELIVERY
    // ==========================================

    if (
      dto.status ===
      "OUT_FOR_DELIVERY"
    ) {
      updateData.outForDeliveryAt =
        new Date();
    }

    // ==========================================
    // DELIVERED
    // ==========================================

    if (
      dto.status ===
      "DELIVERED"
    ) {
      updateData.deliveredAt =
        new Date();

      updateData.rewardPoints =
        5;
    }

    // ==========================================
    // CANCELLED - RESTORE PRODUCT STOCK
    // ==========================================

    if (
      dto.status === "CANCELLED" &&
      order.status !== "CANCELLED"
    ) {
      const itemsToRestore =
        await db.query.orderItems.findMany({
          where: eq(
            orderItems.orderId,
            order.id,
          ),
        });

      for (const item of itemsToRestore) {
        const product =
          await db.query.products.findFirst({
            where: eq(
              products.id,
              item.productId,
            ),
          });

        if (product) {
          const currentCases =
            Math.max(0, parseInt(product.stock, 10) || 0);
          const unitsPerCase =
            parseInt(product.quantityPerUnit, 10) || 1;
          const cases =
            Number(item.cases) || 0;
          const loose =
            Number(item.extraQuantity) || 0;
          const totalUnitsToRestore =
            (cases * unitsPerCase) + loose;
          const newTotalUnits =
            (currentCases * unitsPerCase) + totalUnitsToRestore;
          const newCases =
            Math.floor(newTotalUnits / unitsPerCase);

          await db
            .update(products)
            .set({
              stock: String(newCases),
            })
            .where(
              eq(
                products.id,
                product.id,
              ),
            );
        }
      }
    }

    // ==========================================
    // UPDATE ORDER
    // ==========================================

    const [updated] =
      await db
        .update(orders)
        .set(
          updateData,
        )
        .where(
          eq(
            orders.id,
            id,
          ),
        )
        .returning();

    // ==========================================
    // REWARD SHOP ONCE (5 Points per Delivered Order)
    // ==========================================

    if (
      dto.status ===
        "DELIVERED" &&
      order.rewardPoints === 0
    ) {
      await db
        .insert(
          rewardTransactions,
        )
        .values({
          shopId:
            order.shopId,

          orderId:
            order.id,

          points: 5,

          type:
            "EARN",

          description:
            "Order Delivered (+5 Coins)",
        });
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return {
      success: true,

      message:
        dto.status ===
        "SCHEDULED"
          ? "Delivery day assigned successfully."
          : "Order updated successfully.",

      order:
        updated,
    };
  }
}