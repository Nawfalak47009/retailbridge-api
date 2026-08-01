import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { integer } from "drizzle-orm/pg-core";


export const users = pgTable(
  "users",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    email: varchar({
      length: 255,
    }).notNull(),

    password: varchar({
      length: 255,
    }).notNull(),

    role: varchar({
      length: 20,
    }).notNull(),

    status: varchar({
      length: 20,
    }).default("PENDING"),

    aadhaar: varchar({
      length: 500,
    }),

    gst: varchar({
      length: 500,
    }),

    pan: varchar({
      length: 500,
    }),

    license: varchar({
      length: 500,
    }),

    createdAt:
      timestamp().defaultNow(),
  },
);

export const agencies = pgTable(
  "agencies",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    userId: varchar({
      length: 255,
    }).notNull(),

    agencyName: varchar({
      length: 255,
    }).notNull(),

    ownerName: varchar({
      length: 255,
    }).notNull(),

    phone: varchar({
      length: 20,
    }).notNull(),
  }
);

export const shops = pgTable(
  "shops",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    userId: varchar({
      length: 255,
    }).notNull(),

    shopName: varchar({
      length: 255,
    }).notNull(),

    ownerName: varchar({
      length: 255,
    }).notNull(),

    phone: varchar({
      length: 20,
    }).notNull(),

    address: varchar({
      length: 500,
    }).notNull(),

    pincode: varchar({
      length: 20,
    }).notNull(),

    category: varchar({
      length: 100,
    }).notNull(),

    aadhaar: varchar({
      length: 500,
    }),

    shopPhoto: varchar({
      length: 500,
    }),
  },
);

export const documents =
  pgTable(
    "documents",
    {
      id: uuid()
        .defaultRandom()
        .primaryKey(),

      userId: varchar({
        length: 255,
      }).notNull(),

      documentType:
        varchar({
          length: 100,
        }).notNull(),

      documentUrl:
        varchar({
          length: 500,
        }).notNull(),

      createdAt:
        timestamp()
          .defaultNow()
          .notNull(),
    },
  );

export const products = pgTable(
  "products",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    name: varchar({
      length: 255,
    }).notNull(),

    category: varchar({
      length: 100,
    }).notNull(),

    image: varchar({
      length: 500,
    }).notNull(),

    unit: varchar({
      length: 50,
    }).notNull(),

    quantityPerUnit: varchar({
      length: 50,
    }).notNull(),

    price: varchar({
      length: 50,
    }).notNull(),

    stock: varchar({
      length: 50,
    }).notNull(),

    isActive: varchar({
      length: 10,
    }).default("true"),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);

export const orders = pgTable(
  "orders",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    status: varchar({
      length: 50,
    })
      .default("PENDING")
      .notNull(),

    remarks: varchar({
      length: 500,
    }),

    // NEW
    deliveryDate: timestamp(),

    deliveredAt: timestamp(),

    deliveryPerson:
      varchar({
        length: 255,
      }),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    orderId: varchar({
      length: 255,
    }).notNull(),

    productId: varchar({
      length: 255,
    }).notNull(),

    cases: varchar({
      length: 50,
    }).notNull(),

    extraQuantity: varchar({
      length: 50,
    }),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const agencyShops = pgTable(
  "agency_shops",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    deliveryDay: varchar({
      length: 20,
    }).notNull(),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const agencyProfiles = pgTable(
  "agency_profiles",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    address: varchar({
      length: 255,
    }),

    gst: varchar({
      length: 100,
    }),

    logo: varchar({
      length: 500,
    }),

    description:
      varchar({
        length: 500,
      }),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const shopProfiles = pgTable(
  "shop_profiles",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    address: varchar({
      length: 255,
    }),

    deliveryNotes:
      varchar({
        length: 500,
      }),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const carts = pgTable(
  "carts",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    cartId: varchar({
      length: 255,
    }).notNull(),

    productId: varchar({
      length: 255,
    }).notNull(),

   quantity: integer().notNull(),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);
