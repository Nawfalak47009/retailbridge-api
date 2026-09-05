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

    customId: varchar({
      length: 50,
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

    logo: varchar({
      length: 500,
    }),

    category: varchar({
      length: 50,
    }),

    customId: varchar({
      length: 50,
    }),
  }
);

export const shops = pgTable("shops", {
  id: uuid().defaultRandom().primaryKey(),

  userId: varchar({ length: 255 }).notNull(),

  shopName: varchar({ length: 255 }).notNull(),

  ownerName: varchar({ length: 255 }).notNull(),

  phone: varchar({ length: 20 }).notNull(),

  address: varchar({ length: 500 }).notNull(),

  pincode: varchar({ length: 10 }).notNull(),

  landmark: varchar({ length: 255 }),

  customId: varchar({ length: 50 }),

  image: varchar({ length: 500 }),

  createdAt: timestamp().defaultNow().notNull(),
});
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

    loosePrice: varchar({
      length: 50,
    }),

    gstPercent: varchar({
      length: 20,
    }).default("0"),

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

    orderNumber: varchar({
      length: 30,
    }),

    shopId: varchar({
      length: 255,
    }).notNull(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    totalAmount: integer()
      .default(0)
      .notNull(),

    deliveryAddress: varchar({
      length: 500,
    }),

    deliveryPincode: varchar({
      length: 20,
    }),

    status: varchar({
      length: 50,
    })
      .default("PENDING")
      .notNull(),

    paymentStatus: varchar({
      length: 30,
    })
      .default("UNPAID")
      .notNull(),

    rewardPoints: integer()
      .default(0)
      .notNull(),

    remarks: varchar({
      length: 500,
    }),

    trackingMessage: varchar({
      length: 500,
    }),

    deliveryPerson: varchar({
      length: 255,
    }),

    deliveryPhone: varchar({
      length: 20,
    }),

    scheduledDate: timestamp(),

    acceptedAt: timestamp(),

    outForDeliveryAt: timestamp(),

    deliveredAt: timestamp(),

    slotId: varchar({
  length: 255,
}),

    createdAt: timestamp()
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

    image:
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

export const agencyShopRequests = pgTable(
  "agency_shop_requests",
  {
    id: uuid().defaultRandom().primaryKey(),

    agencyId: varchar({
      length: 255,
    }).notNull(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    requestedBy: varchar({
      length: 20,
    }).notNull(),

    status: varchar({
      length: 20,
    })
      .default("PENDING")
      .notNull(),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);

export const agencyShopConnections =
  pgTable(
    "agency_shop_connections",
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

      connectedAt:
        timestamp()
          .defaultNow()
          .notNull(),
    },
  );

export const deliverySlots = pgTable(
  "delivery_slots",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    // Agency that owns the delivery day
    agencyId: varchar({
      length: 255,
    }).notNull(),

    // Connected shop for whom
    // this delivery day is created
    shopId: varchar({
      length: 255,
    }).notNull(),

    // Automatically derived from deliveryDate
    // Example: Monday, Thursday, Saturday
    day: varchar({
      length: 20,
    }).notNull(),

    // Actual delivery date
    // Example: 2026-08-13
    deliveryDate: timestamp()
      .notNull(),

    // Whether this delivery day is active
    isActive: varchar({
      length: 10,
    })
      .default("true")
      .notNull(),

    createdAt:
      timestamp()
        .defaultNow()
        .notNull(),
  },
);

export const rewardTransactions = pgTable(
  "reward_transactions",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    shopId: varchar({
      length: 255,
    }).notNull(),

    orderId: varchar({
      length: 255,
    }),

    points: integer().notNull(),

    type: varchar({
      length: 30,
    }).notNull(),

    description: varchar({
      length: 255,
    }),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid()
      .defaultRandom()
      .primaryKey(),

    userId: varchar({
      length: 255,
    }).notNull(),

    token: varchar({
      length: 1000,
    }).notNull(),

    deviceInfo: varchar({
      length: 255,
    }),

    createdAt: timestamp()
      .defaultNow()
      .notNull(),

    lastActiveAt: timestamp()
      .defaultNow()
      .notNull(),
  },
);


