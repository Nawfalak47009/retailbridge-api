import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  agencies,
  products,
} from "../db/schema";
import { S3Service } from "../documents/s3.service";

import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

  // ==========================================
  // CREATE PRODUCT
  // ==========================================

  async create(
    userId: string,
    dto: CreateProductDto,
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

   const [product] =
  await db
    .insert(products)
    .values({
      agencyId: agency.id,
      name: dto.name,
      category: dto.category,
      image: dto.image,
      unit: dto.unit,
      quantityPerUnit:
        dto.quantityPerUnit,
      price: dto.price,
      stock: dto.stock,
      isActive:
        dto.isActive ?? "true",
    })
    .returning();
    return {
      success: true,
      message:
        "Product added successfully.",
      product,
    };
  }

  // ==========================================
  // MY PRODUCTS
  // ==========================================

  async findMine(
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

    return this.findByAgency(
      agency.id,
    );
  }

  // ==========================================
  // ALL PRODUCTS
  // ==========================================

  async findAll() {
  const data = await db.query.products.findMany();

  return Promise.all(
    data.map(async (product) => {
      let key = product.image;

      if (key.startsWith("http")) {
        key = key
          .split("?")[0]
          .split("/")
          .pop()!;
      }

      const agency =
        await db.query.agencies.findFirst({
          where: eq(
            agencies.id,
            product.agencyId,
          ),
        });

      return {
        ...product,

        agencyName:
          agency?.agencyName ?? "",

        ownerName:
          agency?.ownerName ?? "",

        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),
      };
    }),
  );
}

  // ==========================================
  // PRODUCTS BY AGENCY
  // ==========================================

 async findByAgency(
  agencyId: string,
) {
  const agency =
    await db.query.agencies.findFirst({
      where: eq(
        agencies.id,
        agencyId,
      ),
    });

  const data = await db
    .select()
    .from(products)
    .where(
      eq(
        products.agencyId,
        agencyId,
      ),
    );

  return Promise.all(
    data.map(async (product) => {
      let key = product.image;

      if (key.startsWith("http")) {
        key = key
          .split("?")[0]
          .split("/")
          .pop()!;
      }

      return {
        ...product,
        agencyName:
          agency?.agencyName ?? "",
        ownerName:
          agency?.ownerName ?? "",
        image:
          await this.s3Service.getSignedImageUrl(
            key,
          ),
      };
    }),
  );
}

  // ==========================================
  // SINGLE PRODUCT
  // ==========================================

 async findOne(id: string) {
  if (!id || id === "undefined") {
    throw new NotFoundException(
      "Invalid product id.",
    );
  }

  const product =
    await db.query.products.findFirst({
      where: eq(
        products.id,
        id,
      ),
    });

  if (!product) {
    throw new NotFoundException(
      "Product not found.",
    );
  }

  const agency =
    await db.query.agencies.findFirst({
      where: eq(
        agencies.id,
        product.agencyId,
      ),
    });

  let key = product.image;

  if (key.startsWith("http")) {
    key = key
      .split("?")[0]
      .split("/")
      .pop()!;
  }

  return {
    ...product,
    agencyName:
      agency?.agencyName ?? "",
    ownerName:
      agency?.ownerName ?? "",
    image:
      await this.s3Service.getSignedImageUrl(
        key,
      ),
  };
}

  // ==========================================
  // UPDATE PRODUCT
  // ==========================================

  async update(
    userId: string,
    id: string,
    dto: UpdateProductDto,
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

    const product =
      await db.query.products.findFirst({
        where: eq(
          products.id,
          id,
        ),
      });

    if (!product) {
      throw new NotFoundException(
        "Product not found.",
      );
    }

    if (
      product.agencyId !==
      agency.id
    ) {
      throw new UnauthorizedException(
        "You cannot update this product.",
      );
    }

    const [updated] =
      await db
        .update(products)
        .set(dto)
        .where(
          eq(
            products.id,
            id,
          ),
        )
        .returning();

    let key = updated.image;

if (key.startsWith("http")) {
  key = key
    .split("?")[0]
    .split("/")
    .pop()!;
}

return {
  success: true,
  message:
    "Product updated successfully.",
  product: {
    ...updated,
    image:
      await this.s3Service.getSignedImageUrl(
        key,
      ),
  },
};
  }

  // ==========================================
  // DELETE PRODUCT
  // ==========================================

  async remove(
    userId: string,
    id: string,
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

    const product =
      await db.query.products.findFirst({
        where: eq(
          products.id,
          id,
        ),
      });

    if (!product) {
      throw new NotFoundException(
        "Product not found.",
      );
    }

    if (
      product.agencyId !==
      agency.id
    ) {
      throw new UnauthorizedException(
        "You cannot delete this product.",
      );
    }

    await db
      .delete(products)
      .where(
        eq(
          products.id,
          id,
        ),
      );

    return {
      success: true,
      message:
        "Product deleted successfully.",
    };
  }
}