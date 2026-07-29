import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { products } from "../db/schema";
import { S3Service } from "../documents/s3.service";

import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateProductDto) {
    const [product] = await db
      .insert(products)
      .values(dto)
      .returning();

    return {
      success: true,
      message: "Product added successfully.",
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
}}