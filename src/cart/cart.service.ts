import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";

import {
  eq,
  and,
} from "drizzle-orm";

import { S3Service } from "../documents/s3.service";

import { db } from "../db";

import {
  carts,
  cartItems,
  products,
  shops,
  agencies,
  orders,
  orderItems,
  agencyShopConnections,
  deliverySlots,
} from "../db/schema";

import { CheckoutDto } from "./dto/checkout.dto";
import { AddCartDto } from "./dto/add-cart.dto";

@Injectable()
export class CartService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

  // ==========================================
  // ADD PRODUCT TO CART
  // ==========================================

  async addToCart(
    userId: string,
    dto: AddCartDto,
  ) {
    // Find logged-in shop
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

    // Find product
    const product =
      await db.query.products.findFirst({
        where: eq(
          products.id,
          dto.productId,
        ),
      });

    if (!product) {
      throw new NotFoundException(
        "Product not found.",
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
            product.agencyId,
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
    // FIND EXISTING CART
    // ==========================================

    let cart =
      await db.query.carts.findFirst({
        where: and(
          eq(
            carts.shopId,
            shop.id,
          ),
          eq(
            carts.agencyId,
            product.agencyId,
          ),
        ),
      });

    // ==========================================
    // CREATE CART IF NEEDED
    // ==========================================

    if (!cart) {
      const [newCart] =
        await db
          .insert(carts)
          .values({
            shopId: shop.id,
            agencyId:
              product.agencyId,
          })
          .returning();

      cart = newCart;
    }

    // ==========================================
    // CHECK EXISTING CART ITEM
    // ==========================================

    const existingItem =
      await db.query.cartItems.findFirst({
        where: and(
          eq(
            cartItems.cartId,
            cart.id,
          ),
          eq(
            cartItems.productId,
            product.id,
          ),
        ),
      });

    if (existingItem) {
      const newQuantity =
        Number(
          existingItem.quantity,
        ) + dto.quantity;

      const [updated] =
        await db
          .update(cartItems)
          .set({
            quantity:
              newQuantity,
          })
          .where(
            eq(
              cartItems.id,
              existingItem.id,
            ),
          )
          .returning();

      return {
        success: true,
        message:
          "Cart updated successfully.",
        item: updated,
      };
    }

    // ==========================================
    // ADD NEW CART ITEM
    // ==========================================

    const [item] =
      await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productId:
            product.id,
          quantity:
            dto.quantity,
        })
        .returning();

    return {
      success: true,
      message:
        "Product added to cart.",
      item,
    };
  }

  // ==========================================
  // GET CART
  // ==========================================

  async getCart(
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

    const userCarts =
      await db.query.carts.findMany({
        where: eq(
          carts.shopId,
          shop.id,
        ),
      });

    const result: any[] = [];

    for (
      const cart of userCarts
    ) {
      // ========================================
      // AGENCY
      // ========================================

      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            cart.agencyId,
          ),
        });

      // ========================================
      // CART ITEMS
      // ========================================

      const items =
        await db.query.cartItems.findMany({
          where: eq(
            cartItems.cartId,
            cart.id,
          ),
        });

      // ========================================
      // PRODUCTS
      // ========================================

      const productsData =
        await Promise.all(
          items.map(
            async (item) => {
              const product =
                await db.query.products.findFirst({
                  where: eq(
                    products.id,
                    item.productId,
                  ),
                });

              if (!product) {
                return null;
              }

              let key =
                product.image;

              if (
                key.startsWith(
                  "http",
                )
              ) {
                key = key
                  .split("?")[0]
                  .split("/")
                  .pop()!;
              }

              return {
                id: item.id,

                quantity:
                  item.quantity,

                product: {
                  ...product,

                  image:
                    await this.s3Service.getSignedImageUrl(
                      key,
                    ),
                },
              };
            },
          ),
        );

      result.push({
        cartId: cart.id,
        agencyId:
          cart.agencyId,
        agencyName:
          agency?.agencyName ??
          "Agency",
        items:
          productsData.filter(
            Boolean,
          ),
      });
    }

    return result;
  }

  // ==========================================
  // UPDATE CART ITEM QUANTITY
  // ==========================================

  async updateQuantity(
    userId: string,
    itemId: string,
    quantity: number,
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

    const item =
      await db.query.cartItems.findFirst({
        where: eq(
          cartItems.id,
          itemId,
        ),
      });

    if (!item) {
      throw new NotFoundException(
        "Cart item not found.",
      );
    }

    const cart =
      await db.query.carts.findFirst({
        where: eq(
          carts.id,
          item.cartId,
        ),
      });

    if (!cart) {
      throw new NotFoundException(
        "Cart not found.",
      );
    }

    if (
      cart.shopId !==
      shop.id
    ) {
      throw new NotFoundException(
        "Unauthorized.",
      );
    }

    const [updated] =
      await db
        .update(cartItems)
        .set({
          quantity,
        })
        .where(
          eq(
            cartItems.id,
            itemId,
          ),
        )
        .returning();

    return {
      success: true,
      message:
        "Quantity updated successfully.",
      item: updated,
    };
  }

  // ==========================================
  // REMOVE CART ITEM
  // ==========================================

  async removeItem(
    userId: string,
    itemId: string,
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

    const item =
      await db.query.cartItems.findFirst({
        where: eq(
          cartItems.id,
          itemId,
        ),
      });

    if (!item) {
      throw new NotFoundException(
        "Cart item not found.",
      );
    }

    const cart =
      await db.query.carts.findFirst({
        where: eq(
          carts.id,
          item.cartId,
        ),
      });

    if (!cart) {
      throw new NotFoundException(
        "Cart not found.",
      );
    }

    if (
      cart.shopId !==
      shop.id
    ) {
      throw new NotFoundException(
        "Unauthorized.",
      );
    }

    await db
      .delete(cartItems)
      .where(
        eq(
          cartItems.id,
          itemId,
        ),
      );

    return {
      success: true,
      message:
        "Item removed successfully.",
    };
  }

  // ==========================================
  // CLEAR CART
  // ==========================================

  async clearCart(
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

    const userCarts =
      await db.query.carts.findMany({
        where: eq(
          carts.shopId,
          shop.id,
        ),
      });

    for (
      const cart of userCarts
    ) {
      await db
        .delete(cartItems)
        .where(
          eq(
            cartItems.cartId,
            cart.id,
          ),
        );

      await db
        .delete(carts)
        .where(
          eq(
            carts.id,
            cart.id,
          ),
        );
    }

    return {
      success: true,
      message:
        "Cart cleared successfully.",
    };
  }

  // ==========================================
  // CHECKOUT
  // ==========================================

  async checkout(
    userId: string,
    dto: CheckoutDto,
  ) {
    // ==========================================
    // FIND LOGGED-IN SHOP
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
    // UPDATE SHOP ADDRESS
    // ==========================================

    await db
      .update(shops)
      .set({
        address:
          dto.deliveryAddress,

        pincode:
          dto.deliveryPincode,
      })
      .where(
        eq(
          shops.id,
          shop.id,
        ),
      );

    // ==========================================
    // FIND CARTS
    // ==========================================

    const userCarts =
      await db.query.carts.findMany({
        where: eq(
          carts.shopId,
          shop.id,
        ),
      });

    if (
      userCarts.length === 0
    ) {
      throw new NotFoundException(
        "Cart is empty.",
      );
    }

    const createdOrders:
      typeof orders.$inferSelect[] =
      [];

    // ==========================================
    // PROCESS EACH AGENCY CART
    // ==========================================

    for (
      const cart of userCarts
    ) {
      // ========================================
      // FIND AGENCY
      // ========================================

      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            cart.agencyId,
          ),
        });

      if (!agency) {
        throw new NotFoundException(
          "Agency not found.",
        );
      }

      // ========================================
      // CHECK SHOP ↔ AGENCY CONNECTION
      // ========================================

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
          `Your shop is not connected to ${agency.agencyName}.`,
        );
      }

      // ========================================
      // FIND ACTIVE DELIVERY DAY
      // ========================================

      const deliveryDay =
        await db.query.deliverySlots.findFirst({
          where: and(
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
        });

      // ========================================
      // DETERMINE DELIVERY DATE
      // ========================================

      let scheduledDate:
        Date | null = null;

      if (deliveryDay) {
        scheduledDate =
          new Date(
            deliveryDay.deliveryDate,
          );

        if (
          Number.isNaN(
            scheduledDate.getTime(),
          )
        ) {
          throw new BadRequestException(
            "The agency delivery day contains an invalid delivery date.",
          );
        }

        // Normalize to midnight
        scheduledDate.setHours(
          0,
          0,
          0,
          0,
        );
      }

      // ========================================
      // GET CART ITEMS
      // ========================================

      const items =
        await db.query.cartItems.findMany({
          where: eq(
            cartItems.cartId,
            cart.id,
          ),
        });

      if (
        items.length === 0
      ) {
        continue;
      }

      // ========================================
      // CALCULATE TOTAL (Cases + Loose Units)
      // ========================================

      let totalAmount = 0;

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
          throw new NotFoundException(
            `Product ${item.productId} not found.`,
          );
        }

        const unitsPerCase =
          parseInt(product.quantityPerUnit, 10) || 1;
        const totalUnits =
          Number(item.quantity) || 0;
        const casesCount =
          Math.floor(totalUnits / unitsPerCase);
        const looseCount =
          totalUnits % unitsPerCase;

        const pricePerCase =
          Number(product.price) || 0;
        const pricePerUnit =
          product.loosePrice && Number(product.loosePrice) > 0
            ? Number(product.loosePrice)
            : unitsPerCase > 1
            ? Number((pricePerCase / unitsPerCase).toFixed(2))
            : pricePerCase;

        const itemTotal =
          Math.round(
            (casesCount * pricePerCase) +
            (looseCount * pricePerUnit),
          );

        totalAmount += itemTotal;
      }

      // ========================================
      // DETERMINE ORDER STATUS
      // ========================================

      const orderStatus =
        deliveryDay
          ? "SCHEDULED"
          : "DELIVERY_SCHEDULE_PENDING";

      // ========================================
      // CREATE ORDER
      // ========================================

      const [order] =
        await db
          .insert(orders)
          .values({
            shopId:
              shop.id,

            agencyId:
              agency.id,

            // Temporary legacy compatibility.
            // Remove after slotId migration
            // is completed.
            slotId:
              deliveryDay?.id ??
              null,

            status:
              orderStatus,

            totalAmount,

            deliveryAddress:
              dto.deliveryAddress,

            deliveryPincode:
              dto.deliveryPincode,

            scheduledDate,

            remarks:
              dto.remarks ??
              "",
          })
          .returning();

      // ========================================
      // CREATE ORDER ITEMS (Cases + Loose)
      // ========================================

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

        const unitsPerCase = product
          ? parseInt(product.quantityPerUnit, 10) || 1
          : 1;
        const totalUnits =
          Number(item.quantity) || 0;
        const casesCount =
          Math.floor(totalUnits / unitsPerCase);
        const looseCount =
          totalUnits % unitsPerCase;

        await db
          .insert(orderItems)
          .values({
            orderId:
              order.id,

            productId:
              item.productId,

            cases:
              String(casesCount),

            extraQuantity:
              String(looseCount),
          });
      }

      // ========================================
      // CLEAR THIS AGENCY CART
      // ========================================

      await db
        .delete(cartItems)
        .where(
          eq(
            cartItems.cartId,
            cart.id,
          ),
        );

      await db
        .delete(carts)
        .where(
          eq(
            carts.id,
            cart.id,
          ),
        );

      createdOrders.push(
        order,
      );
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return {
      success: true,

      message:
        "Order placed successfully.",

      orders:
        createdOrders.map(
          (order) => ({
            ...order,

            scheduledDate:
              order.scheduledDate,

            // Temporary legacy field.
            slotId:
              order.slotId,
          }),
        ),
    };
  }
}