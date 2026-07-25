import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { products } from "../db/schema";

import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  async create(
    dto: CreateProductDto,
  ) {
    const [product] = await db
      .insert(products)
      .values(dto)
      .returning();

    return {
      success: true,
      message:
        "Product added successfully.",
      product,
    };
  }

  async findAll() {
    return db.query.products.findMany();
  }

  async findByAgency(
    agencyId: string,
  ) {
    return await db
      .select()
      .from(products)
      .where(
        eq(
          products.agencyId,
          agencyId,
        ),
      );
  }
}