import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq } from "drizzle-orm";

import * as bcrypt from "bcrypt";

import { db } from "../db";

import {
  users,
  agencies,
  shops,
  orders,
} from "../db/schema";

import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";
import { UpdateAgencyShopDto } from "./dto/update-agency-shop.dto";

@Injectable()
export class AgencyShopsService {
  async createShop(
  userId: string,
  dto: CreateAgencyShopDto,
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
    "Agency not found",
  );
}


const shopCount =
  await db.query.shops.findMany();

const username =
  `SHOP${String(
    shopCount.length + 1,
  ).padStart(4, "0")}`;

  const password =
  Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase();

    const passwordHash =
  await bcrypt.hash(
    password,
    10,
  );

  const createdUser =
  await db
    .insert(users)
    .values({
      email: username,
      password: passwordHash,
      role: "SHOP",
      status: "APPROVED",
    })
    .returning();

    await db.insert(shops).values({
  userId: createdUser[0].id,

  agencyId: agency.id,

  registrationType:
    "AGENCY_CREATED",

  shopName: dto.shopName,

  ownerName: dto.ownerName,

  phone: dto.phone,

  address: dto.address,

  pincode: dto.pincode,

  deliveryDay: dto.deliveryDay,

  deliverySlot: dto.deliverySlot,
});

return {
  success: true,

  message: "Shop created successfully.",

  credentials: {
    username,
    password,
  },
};



}

async getMyShops(userId: string) {
  const agency =
    await db.query.agencies.findFirst({
      where: eq(
        agencies.userId,
        userId,
      ),
    });

  if (!agency) {
    throw new NotFoundException(
      "Agency not found",
    );
  }

  return await db.query.shops.findMany({
    where: eq(
      shops.agencyId,
      agency.id,
    ),
  });
}

async updateShop(
  userId: string,
  shopId: string,
  dto: UpdateAgencyShopDto,
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
      "Agency not found",
    );
  }

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop",
    );
  }

  await db
  .update(shops)
  .set({
    shopName: dto.shopName,
    ownerName: dto.ownerName,
    phone: dto.phone,
    address: dto.address,
    pincode: dto.pincode,
    deliveryDay: dto.deliveryDay,
    deliverySlot: dto.deliverySlot,
  })
  .where(eq(shops.id, shopId));

  return {
    success: true,
    message:
      "Shop updated successfully.",
  };
}

async findOne(
  userId: string,
  shopId: string,
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

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found.",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop.",
    );
  }

  return {
    success: true,
    shop,
  };
}

async deleteShop(
  userId: string,
  shopId: string,
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
      "Agency not found",
    );
  }

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop",
    );
  }

  // Delete login account
  await db
    .delete(users)
    .where(eq(users.id, shop.userId));

  // Delete shop
  await db
    .delete(shops)
    .where(eq(shops.id, shopId));

  return {
    success: true,
    message:
      "Shop deleted successfully.",
  };
}

async getCredentials(
  userId: string,
  shopId: string,
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

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found.",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop.",
    );
  }

  const user =
    await db.query.users.findFirst({
      where: eq(
        users.id,
        shop.userId,
      ),
    });

  if (!user) {
    throw new NotFoundException(
      "Login account not found.",
    );
  }

  return {
    success: true,

    credentials: {
      username: user.email,

      shopName: shop.shopName,

      ownerName: shop.ownerName,

      phone: shop.phone,
    },
  };
}
async resetPassword(
  userId: string,
  shopId: string,
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

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found.",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop.",
    );
  }

  const user =
    await db.query.users.findFirst({
      where: eq(
        users.id,
        shop.userId,
      ),
    });

  if (!user) {
    throw new NotFoundException(
      "Login account not found.",
    );
  }

  // Generate new password
  const password =
    Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

  const passwordHash =
    await bcrypt.hash(
      password,
      10,
    );

  await db
    .update(users)
    .set({
      password: passwordHash,
    })
    .where(
      eq(
        users.id,
        user.id,
      ),
    );

  return {
    success: true,

    message:
      "Password reset successfully.",

    credentials: {
      username: user.email,

      password,
    },
  };
}
async getShopOrders(
  userId: string,
  shopId: string,
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

  const shop =
    await db.query.shops.findFirst({
      where: eq(
        shops.id,
        shopId,
      ),
    });

  if (!shop) {
    throw new NotFoundException(
      "Shop not found.",
    );
  }

  if (shop.agencyId !== agency.id) {
    throw new NotFoundException(
      "Unauthorized shop.",
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

  return {
    success: true,

    shop,

    orders: shopOrders,
  };
}
}