import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

import {
  eq,
  and,
  inArray,
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
import { PushNotificationsService } from "../notifications/push-notifications.service";

function formatUnitBreakdown(cases: number, loose: number, unit?: string | null): string {
  const baseUnit = (unit && unit.trim()) || "Case";
  const unitLower = baseUnit.toLowerCase();

  let singular = baseUnit;
  if (unitLower.endsWith("s") && !unitLower.endsWith("ss") && unitLower !== "glass") {
    singular = baseUnit.slice(0, -1);
  }

  let plural = baseUnit;
  if (unitLower.endsWith("s") || unitLower.endsWith("x") || unitLower.endsWith("ch") || unitLower.endsWith("sh")) {
    plural = baseUnit.endsWith("es") ? baseUnit : `${baseUnit}es`;
  } else if (!baseUnit.endsWith("s")) {
    plural = `${baseUnit}s`;
  }

  const unitText = cases === 1 ? singular : plural;
  const pieceText = loose === 1 ? "Piece" : "Pieces";

  if (cases > 0 && loose > 0) {
    return `${cases} ${unitText} + ${loose} ${pieceText}`;
  } else if (cases > 0) {
    return `${cases} ${unitText}`;
  } else if (loose > 0) {
    return `${loose} ${pieceText}`;
  } else {
    return `${cases} ${plural}`;
  }
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly pushNotificationsService: PushNotificationsService,
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
      throw new ForbiddenException(
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
            selectedDeliveryDate ?? null,

          status:
            selectedDeliveryDay
              ? "SCHEDULED"
              : "PENDING",

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

  private async getSignedUrlsMap(rawKeys: (string | null | undefined)[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniqueKeys = [...new Set(rawKeys.filter(Boolean) as string[])];
    await Promise.all(
      uniqueKeys.map(async (rawKey) => {
        let key = rawKey;
        if (key.startsWith("http")) {
          key = key.split("?")[0].split("/").pop()!;
        }
        try {
          const url = await this.s3Service.getSignedImageUrl(key);
          map.set(rawKey, url);
        } catch {
          map.set(rawKey, rawKey);
        }
      }),
    );
    return map;
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

    if (agencyOrders.length === 0) {
      return [];
    }

    const orderIds = agencyOrders.map((o) => o.id);
    const shopIds = [...new Set(agencyOrders.map((o) => o.shopId).filter(Boolean))];
    const slotIds = [...new Set(agencyOrders.map((o) => o.slotId).filter(Boolean) as string[])];

    // Stage 1: Batch fetch all related data in parallel
    const [allShops, allItems, allSlots, allConnections, allPendingRequests] = await Promise.all([
      shopIds.length > 0 ? db.query.shops.findMany({ where: inArray(shops.id, shopIds) }) : [],
      db.query.orderItems.findMany({ where: inArray(orderItems.orderId, orderIds) }),
      slotIds.length > 0 ? db.query.deliverySlots.findMany({ where: inArray(deliverySlots.id, slotIds) }) : [],
      shopIds.length > 0
        ? db.query.agencyShopConnections.findMany({
            where: and(
              eq(agencyShopConnections.agencyId, agency.id),
              inArray(agencyShopConnections.shopId, shopIds),
            ),
          })
        : [],
      shopIds.length > 0
        ? db.query.agencyShopRequests.findMany({
            where: and(
              eq(agencyShopRequests.agencyId, agency.id),
              inArray(agencyShopRequests.shopId, shopIds),
              eq(agencyShopRequests.status, "PENDING"),
            ),
          })
        : [],
    ]);

    // Stage 2: Batch fetch products for all items
    const productIds = [...new Set(allItems.map((i) => i.productId).filter(Boolean))];
    const allProducts =
      productIds.length > 0
        ? await db.query.products.findMany({ where: inArray(products.id, productIds) })
        : [];

    // Stage 3: Batch fetch S3 signed URLs
    const imageMap = await this.getSignedUrlsMap(allProducts.map((p) => p.image));

    // Lookup Maps
    const shopsMap = new Map<string, any>();
    for (const s of allShops) shopsMap.set(s.id, s);

    const slotsMap = new Map<string, any>();
    for (const sl of allSlots) slotsMap.set(sl.id, sl);

    const productsMap = new Map<string, any>();
    for (const p of allProducts) productsMap.set(p.id, p);

    const connectionsMap = new Map<string, any>();
    for (const c of allConnections) connectionsMap.set(c.shopId, c);

    const requestsMap = new Map<string, any>();
    for (const r of allPendingRequests) requestsMap.set(r.shopId, r);

    const itemsByOrderId = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByOrderId.get(item.orderId) || [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    // Assemble response in memory (O(1) lookups, 0 extra SQL queries)
    const response: any[] = [];
    for (const order of agencyOrders) {
      const shop = shopsMap.get(order.shopId);
      const items = itemsByOrderId.get(order.id) || [];
      const productsData: any[] = [];
      let totalAmount = 0;
      let totalQuantity = 0;
      let totalGstAmount = 0;

      for (const item of items) {
        const product = productsMap.get(item.productId);
        if (!product) continue;

        const cases = Number(item.cases) || 0;
        const loose = Number(item.extraQuantity) || 0;
        const unitsPerCase = parseInt(product.quantityPerUnit, 10) || 1;
        const totalUnits = (cases * unitsPerCase) + loose;

        const pricePerCase = Number(product.price) || 0;
        const pricePerUnit =
          product.loosePrice && Number(product.loosePrice) > 0
            ? Number(product.loosePrice)
            : unitsPerCase > 1
            ? Number((pricePerCase / unitsPerCase).toFixed(2))
            : pricePerCase;

        const gstPercent = Math.max(0, parseFloat((product as any).gstPercent || "0") || 0);
        const caseGstAmount = (pricePerCase * gstPercent) / 100;
        const totalCaseGst = cases * caseGstAmount;
        const casesSubtotal = Math.round(cases * (pricePerCase + caseGstAmount));
        const looseSubtotal = Math.round(loose * pricePerUnit);
        const itemSubtotal = casesSubtotal + looseSubtotal;

        totalAmount += itemSubtotal;
        totalQuantity += totalUnits;
        totalGstAmount += totalCaseGst;

        const packBreakdown = formatUnitBreakdown(cases, loose, product.unit);
        const signedImage = imageMap.get(product.image) || product.image;

        productsData.push({
          id: product.id,
          name: product.name,
          image: signedImage,
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
          subtotal: itemSubtotal,
          packBreakdown,
          unit: product.unit,
          quantityPerUnit: product.quantityPerUnit,
        });
      }

      let deliveryDay = order.slotId ? slotsMap.get(order.slotId) : undefined;
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
        if (schedTime < createdTime) {
          effectiveScheduledDate = deliveryDay
            ? calculateNextDeliveryDate(
                deliveryDay,
                new Date(order.createdAt),
              )
            : null;
        }
      }

      const connection = connectionsMap.get(order.shopId);
      const pendingRequest = !connection ? requestsMap.get(order.shopId) : null;

      response.push({
        id: order.id,
        orderNumber: order.orderNumber,
        shopId: order.shopId,
        agencyId: order.agencyId,
        slotId: order.slotId,
        status: order.status,
        isConnected: Boolean(connection),
        hasPendingRequest: Boolean(pendingRequest),
        connectionRequestId: pendingRequest?.id || null,
        createdAt: order.createdAt,
        remarks: order.remarks,
        totalAmount: totalAmount > 0 ? totalAmount : Number(order.totalAmount || 0),
        totalGstAmount: Math.round(totalGstAmount),
        totalQuantity,
        totalItems: productsData.length,
        rewardPoints: order.rewardPoints,
        deliveryPerson: order.deliveryPerson,
        deliveryPhone: order.deliveryPhone,
        trackingMessage: order.trackingMessage,
        scheduledDate: effectiveScheduledDate,
        deliveryDay: deliveryDay
          ? {
              id: deliveryDay.id,
              day: deliveryDay.day,
              deliveryDate: effectiveScheduledDate || deliveryDay.deliveryDate,
            }
          : null,
        shop: shop && {
          id: shop.id,
          shopName: shop.shopName,
          ownerName: shop.ownerName,
          phone: shop.phone,
          address: shop.address,
          pincode: shop.pincode,
        },
        items: productsData,
        products: productsData,
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

    if (shopOrders.length === 0) {
      return [];
    }

    const orderIds = shopOrders.map((o) => o.id);
    const agencyIds = [...new Set(shopOrders.map((o) => o.agencyId).filter(Boolean))];
    const slotIds = [...new Set(shopOrders.map((o) => o.slotId).filter(Boolean) as string[])];

    // Stage 1: Batch fetch all related data in parallel
    const [allAgencies, allItems, allSlots] = await Promise.all([
      agencyIds.length > 0 ? db.query.agencies.findMany({ where: inArray(agencies.id, agencyIds) }) : [],
      db.query.orderItems.findMany({ where: inArray(orderItems.orderId, orderIds) }),
      slotIds.length > 0 ? db.query.deliverySlots.findMany({ where: inArray(deliverySlots.id, slotIds) }) : [],
    ]);

    // Stage 2: Batch fetch products for all items
    const productIds = [...new Set(allItems.map((i) => i.productId).filter(Boolean))];
    const allProducts =
      productIds.length > 0
        ? await db.query.products.findMany({ where: inArray(products.id, productIds) })
        : [];

    // Stage 3: Batch fetch S3 signed URLs
    const imageMap = await this.getSignedUrlsMap(allProducts.map((p) => p.image));

    // Lookup Maps
    const agenciesMap = new Map<string, any>();
    for (const a of allAgencies) agenciesMap.set(a.id, a);

    const slotsMap = new Map<string, any>();
    for (const sl of allSlots) slotsMap.set(sl.id, sl);

    const productsMap = new Map<string, any>();
    for (const p of allProducts) productsMap.set(p.id, p);

    const itemsByOrderId = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByOrderId.get(item.orderId) || [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    // Assemble response in memory (O(1) lookups, 0 extra SQL queries)
    const response: any[] = [];

    for (const order of shopOrders) {
      const agency = agenciesMap.get(order.agencyId);
      const items = itemsByOrderId.get(order.id) || [];

      const productsData: any[] = [];
      let totalAmount = 0;
      let totalQuantity = 0;
      let totalGstAmount = 0;

      for (const item of items) {
        const product = productsMap.get(item.productId);
        if (!product) continue;

        const cases = Number(item.cases) || 0;
        const loose = Number(item.extraQuantity) || 0;
        const unitsPerCase = parseInt(product.quantityPerUnit, 10) || 1;
        const totalUnits = cases * unitsPerCase + loose;

        const pricePerCase = Number(product.price) || 0;
        const pricePerUnit =
          product.loosePrice && Number(product.loosePrice) > 0
            ? Number(product.loosePrice)
            : unitsPerCase > 1
            ? Number((pricePerCase / unitsPerCase).toFixed(2))
            : pricePerCase;

        const gstPercent = Math.max(0, parseFloat((product as any).gstPercent || "0") || 0);
        const caseGstAmount = (pricePerCase * gstPercent) / 100;
        const totalCaseGst = cases * caseGstAmount;
        const casesSubtotal = Math.round(cases * (pricePerCase + caseGstAmount));
        const looseSubtotal = Math.round(loose * pricePerUnit); // Strictly 0% GST on loose
        const itemSubtotal = casesSubtotal + looseSubtotal;

        totalAmount += itemSubtotal;
        totalQuantity += totalUnits;
        totalGstAmount += totalCaseGst;

        const packBreakdown = formatUnitBreakdown(cases, loose, product.unit);
        const signedImage = imageMap.get(product.image) || product.image;

        productsData.push({
          id: product.id,
          name: product.name,
          image: signedImage,
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
          subtotal: itemSubtotal,
          packBreakdown,
          unit: product.unit,
          quantityPerUnit: product.quantityPerUnit,
        });
      }

      let deliveryDay = order.slotId ? slotsMap.get(order.slotId) : undefined;
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
        if (schedTime < createdTime) {
          effectiveScheduledDate = deliveryDay
            ? calculateNextDeliveryDate(
                deliveryDay,
                new Date(order.createdAt),
              )
            : null;
        }
      }

      response.push({
        id: order.id,
        shopId: order.shopId,
        agencyId: order.agencyId,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        remarks: order.remarks,
        totalAmount: totalAmount > 0 ? totalAmount : Number(order.totalAmount || 0),
        totalGstAmount: Math.round(totalGstAmount),
        totalQuantity,
        totalItems: productsData.length,
        rewardPoints: order.rewardPoints,
        deliveryPerson: order.deliveryPerson,
        deliveryPhone: order.deliveryPhone,
        trackingMessage: order.trackingMessage,
        scheduledDate: effectiveScheduledDate,
        deliveryDay: deliveryDay
          ? {
              id: deliveryDay.id,
              day: deliveryDay.day,
              deliveryDate: effectiveScheduledDate || deliveryDay.deliveryDate,
            }
          : null,
        agency: agency && {
          id: agency.id,
          agencyName: agency.agencyName,
          ownerName: agency.ownerName,
          phone: agency.phone,
        },
        items: productsData,
        products: productsData,
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
        throw new ForbiddenException(
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
        throw new ForbiddenException(
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

      const packBreakdown = formatUnitBreakdown(cases, loose, product.unit);

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
  if (schedTime < createdTime) {
    effectiveScheduledDate = deliveryDay
      ? calculateNextDeliveryDate(
          deliveryDay,
          new Date(order.createdAt),
        )
      : null;
  }
}

    const connection = await db.query.agencyShopConnections.findFirst({
      where: and(
        eq(agencyShopConnections.agencyId, order.agencyId),
        eq(agencyShopConnections.shopId, order.shopId),
      ),
    });

    const pendingRequest = !connection
      ? await db.query.agencyShopRequests.findFirst({
          where: and(
            eq(agencyShopRequests.agencyId, order.agencyId),
            eq(agencyShopRequests.shopId, order.shopId),
            eq(agencyShopRequests.status, "PENDING"),
          ),
        })
      : null;

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

      isConnected: Boolean(connection),
      hasPendingRequest: Boolean(pendingRequest),
      connectionRequestId: pendingRequest?.id || null,

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
      throw new ForbiddenException(
        "You cannot update this order.",
      );
    }

    // ==========================================
    // UPDATE DATA
    // ==========================================

    const updateData: Partial<
      typeof orders.$inferInsert
    > = {
      ...(dto.status ? { status: dto.status } : {}),

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
      "SCHEDULED" ||
      dto.slotId
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
          dto.scheduledDate ||
          dto.deliveryDate ||
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
    // NOTIFY GROCERY USER VIA PUSH (even when app is closed / mobile is locked)
    // ==========================================
    try {
      const shop = await db.query.shops.findFirst({
        where: eq(shops.id, order.shopId),
      });

      if (shop?.userId && (dto.status || dto.slotId)) {
        const orderShort = order.id.slice(0, 8);
        const agencyName = agency.agencyName || "Agency";
        let title = "📋 Order Status Updated";
        let body = dto.status
          ? `Your order #${orderShort} is now ${dto.status.replace(/_/g, " ")}.`
          : `Your order #${orderShort} has been scheduled for delivery.`;

        switch (dto.status) {
          case "ACCEPTED":
            title = "✅ Order Accepted!";
            body = `${agencyName} has accepted and confirmed your order #${orderShort}.`;
            break;
          case "SCHEDULED":
            title = "📅 Delivery Scheduled!";
            body = `Your order #${orderShort} has been scheduled for delivery.`;
            break;
          case "OUT_FOR_DELIVERY":
            title = "🚚 Out For Delivery!";
            body = `Order #${orderShort} is on the delivery vehicle and heading to your shop!`;
            break;
          case "DELIVERED":
            title = "🎉 Order Delivered!";
            body = `Order #${orderShort} has been delivered successfully. (+5 coins earned)`;
            break;
          case "CANCELLED":
            title = "❌ Order Cancelled";
            body = `Order #${orderShort} was cancelled by ${agencyName}.`;
            break;
          default:
            if (dto.slotId) {
              title = "📅 Delivery Scheduled!";
              body = `Your order #${orderShort} has been scheduled for delivery.`;
            }
            break;
        }

        await this.pushNotificationsService.sendToUser(shop.userId, {
          title,
          body,
          screenToOpen: "/(grocery)/orders",
          channelId: "orders",
          data: {
            orderId: order.id,
            orderNumber: orderShort,
            status: dto.status,
            agencyName,
          },
        });
      }
    } catch (pushErr) {
      console.log("Error dispatching order status push notification:", pushErr);
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return {
      success: true,

      message:
        dto.status ===
        "SCHEDULED" || dto.slotId
          ? "Delivery day assigned successfully."
          : "Order updated successfully.",

      order:
        updated,
    };
  }
}