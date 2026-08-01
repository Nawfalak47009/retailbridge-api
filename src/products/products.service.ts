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
  async findAll() {
    const data = await db.query.products.findMany();

    return Promise.all(
      data.map(async (product) => {
        const key = product.image.split("/").pop()!;

        return {
          ...product,
          image: await this.s3Service.getSignedImageUrl(key),
        };
      }),
    );
  }

async findByAgency(agencyId: string) {
  const data = await db
    .select()
    .from(products)
    .where(eq(products.agencyId, agencyId));

  return Promise.all(
    data.map(async (product) => {
      const key = product.image.split("/").pop()!;

      const signedUrl =
        await this.s3Service.getSignedImageUrl(key);

      console.log("SIGNED URL:", signedUrl);

      return {
        ...product,
        image: signedUrl,
      };
    }),
  );
}

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
      where: eq(products.id, id),
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
      .where(eq(products.id, id))
      .returning();

  return {
    success: true,
    message:
      "Product updated successfully.",
    product: updated,
  };
}

async findOne(id: string) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
  });

  if (!product) {
    return null;
  }

  const key = product.image.split("/").pop()!;

  return {
    ...product,
    image: await this.s3Service.getSignedImageUrl(key),
  };
}
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
      where: eq(products.id, id),
    });

  if (!product) {
    throw new NotFoundException(
      "Product not found.",
    );
  }

  if (product.agencyId !== agency.id) {
    throw new UnauthorizedException(
      "You cannot delete this product.",
    );
  }

  await db
    .delete(products)
    .where(eq(products.id, id));

  return {
    success: true,
    message: "Product deleted successfully.",
  };
}
}