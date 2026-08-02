import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq, and } from "drizzle-orm";
import { S3Service } from "../documents/s3.service";

import { db } from "../db";

import {
  carts,
  cartItems,
  products,
  shops,
  agencies,
} from "../db/schema";

import {
  orders,
  orderItems,
} from "../db/schema";

import { CheckoutDto } from "./dto/checkout.dto";

import { AddCartDto } from "./dto/add-cart.dto";

@Injectable()
export class CartService {
 constructor(
  private readonly s3Service: S3Service,
) {}

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

    // Find existing cart
let cart =
  await db.query.carts.findFirst({
    where: and(
      eq(carts.shopId, shop.id),
      eq(
        carts.agencyId,
        product.agencyId,
      ),
    ),
  });

// Create cart if it doesn't exist
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
// Check if product already exists in cart
const existingItem =
  await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cart.id),
      eq(
        cartItems.productId,
        product.id,
      ),
    ),
  });

if (existingItem) {
  const newQuantity =
    Number(existingItem.quantity) +
    dto.quantity;

  const [updated] =
    await db
      .update(cartItems)
      .set({
        quantity: newQuantity,
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


// Add new product to cart
const [item] =
  await db
    .insert(cartItems)
    .values({
      cartId: cart.id,
      productId: product.id,
      quantity: dto.quantity,
    })
    .returning();

    

return {
  success: true,
  message:
    "Product added to cart.",
  item,
};
  }

  async getCart(userId: string) {
  const shop = await db.query.shops.findFirst({
    where: eq(shops.userId, userId),
  });

  if (!shop) {
    throw new NotFoundException("Shop not found.");
  }

  const userCarts = await db.query.carts.findMany({
    where: eq(carts.shopId, shop.id),
  });

  const result: any[] = [];

  for (const cart of userCarts) {
    // Agency
    const agency = await db.query.agencies.findFirst({
      where: eq(agencies.id, cart.agencyId),
    });

    // Cart Items
    const items = await db.query.cartItems.findMany({
      where: eq(cartItems.cartId, cart.id),
    });

    const productsData = await Promise.all(
      items.map(async (item) => {
        const product = await db.query.products.findFirst({
          where: eq(products.id, item.productId),
        });

        if (!product) {
          return null;
        }

        let key = product.image;

        if (key.startsWith("http")) {
          key = key
            .split("?")[0]
            .split("/")
            .pop()!;
        }

        return {
          id: item.id,
          quantity: item.quantity,
          product: {
            ...product,
            image: await this.s3Service.getSignedImageUrl(
              key,
            ),
          },
        };
      }),
    );

    result.push({
      cartId: cart.id,
      agencyId: cart.agencyId,
      agencyName: agency?.agencyName ?? "Agency",
      items: productsData.filter(Boolean),
    });
  }

  return result;
}

async updateQuantity(
  userId: string,
  itemId: string,
  quantity: number,
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

  // Find cart item
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

  // Find cart
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

  // Verify ownership
  if (cart.shopId !== shop.id) {
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

  if (cart.shopId !== shop.id) {
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

  for (const cart of userCarts) {
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

async checkout(
  userId: string,
  dto: CheckoutDto,
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

  // Find carts
  const userCarts =
    await db.query.carts.findMany({
      where: eq(
        carts.shopId,
        shop.id,
      ),
    });

  if (userCarts.length === 0) {
    throw new NotFoundException(
      "Cart is empty.",
    );
  }

 const createdOrders: typeof orders.$inferSelect[] = [];

  for (const cart of userCarts) {
    // Create Order
    const [order] =
      await db
        .insert(orders)
        .values({
          shopId: shop.id,
          agencyId: cart.agencyId,
          remarks:
            dto.remarks ?? "",
        })
        .returning();

    // Cart Items
    const items =
      await db.query.cartItems.findMany({
        where: eq(
          cartItems.cartId,
          cart.id,
        ),
      });

    for (const item of items) {
      await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productId:
            item.productId,
          cases: String(
            item.quantity,
          ),
        });
    }

    // Delete cart items
    await db
      .delete(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      );

    // Delete cart
    await db
      .delete(carts)
      .where(
        eq(
          carts.id,
          cart.id,
        ),
      );

    createdOrders.push(order);
  }

  return {
    success: true,
    message:
      "Order placed successfully.",
    orders: createdOrders,
  };
}

}