import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { eq, and } from "drizzle-orm";

import { db } from "../db";

import {
  agencies,
  products,
  shops,
  agencyShopConnections,
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
          loosePrice: dto.loosePrice,
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

  private async resolveImageUrl(
    image: string | null | undefined,
  ): Promise<{ image: string; imageKey: string }> {
    if (
      !image ||
      typeof image !== "string" ||
      image.trim() === "" ||
      image === "undefined" ||
      image === "null"
    ) {
      return { image: "", imageKey: "" };
    }

    let key = image.trim();
    if (key.startsWith("http://") || key.startsWith("https://")) {
      try {
        const urlObj = new URL(key);
        const parts = urlObj.pathname.split("/").filter(Boolean);
        key = parts[parts.length - 1] || "";
      } catch {
        key = key.split("?")[0].split("/").pop() || "";
      }
    }

    if (!key) {
      return { image: image, imageKey: "" };
    }

    try {
      const signedUrl = await this.s3Service.getSignedImageUrl(key);
      return { image: signedUrl, imageKey: key };
    } catch {
      return { image: image, imageKey: key };
    }
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

    const data =
      await db
        .select()
        .from(products)
        .where(
          eq(
            products.agencyId,
            agency.id,
          ),
        );

    return Promise.all(
      data.map(
        async (product) => {
          const { image, imageKey } =
            await this.resolveImageUrl(product.image);

          return {
            ...product,

            imageKey,

            agencyName:
              agency.agencyName,

            ownerName:
              agency.ownerName,

            image,
          };
        },
      ),
    );
  }

  // ==========================================
  // ALL PRODUCTS AVAILABLE TO SHOP
  // ==========================================

  async findAll(
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

    // ========================================
    // GET ALL PRODUCTS
    // ========================================

    const allProducts =
      await db.query.products.findMany({
        where: eq(products.isActive, "true"),
      });

    return Promise.all(
      allProducts.map(
        async (product) => {
          const { image, imageKey } =
            await this.resolveImageUrl(product.image);

          const agency =
            await db.query.agencies.findFirst({
              where: eq(
                agencies.id,
                product.agencyId,
              ),
            });

          return {
            ...product,

            imageKey,

            agencyName:
              agency?.agencyName ??
              "",

            ownerName:
              agency?.ownerName ??
              "",

            image,
          };
        },
      ),
    );
  }

  // ==========================================
  // PRODUCTS BY AGENCY
  // ==========================================

  async findByAgency(
    userId: string,
    agencyId: string,
  ) {
    // ========================================
    // VERIFY AGENCY
    // ========================================

    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.id,
          agencyId,
        ),
      });

    if (!agency) {
      throw new NotFoundException(
        "Agency not found.",
      );
    }

    // ========================================
    // GET PRODUCTS
    // ========================================

    const data =
      await db
        .select()
        .from(products)
        .where(
          eq(
            products.agencyId,
            agencyId,
          ),
        );

    return Promise.all(
      data.map(
        async (product) => {
          const { image, imageKey } =
            await this.resolveImageUrl(product.image);

          return {
            ...product,

            imageKey,

            agencyName:
              agency.agencyName,

            ownerName:
              agency.ownerName,

            image,
          };
        },
      ),
    );
  }

  // ==========================================
  // SINGLE PRODUCT
  // ==========================================

  async findOne(
    id: string,
  ) {
    if (
      !id ||
      id === "undefined"
    ) {
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

    const { image, imageKey } =
      await this.resolveImageUrl(product.image);

    return {
      ...product,

      imageKey,

      agencyName:
        agency?.agencyName ?? "",

      ownerName:
        agency?.ownerName ?? "",

      image,
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

    const updateData: any = { ...dto };

    // If no new image is provided, or image is empty string / invalid, preserve existing product image!
    if (
      !updateData.image ||
      typeof updateData.image !== "string" ||
      updateData.image.trim() === "" ||
      updateData.image === "undefined" ||
      updateData.image === "null"
    ) {
      delete updateData.image;
    } else {
      let imgKey = updateData.image.trim();
      if (imgKey.startsWith("http://") || imgKey.startsWith("https://")) {
        try {
          const urlObj = new URL(imgKey);
          const parts = urlObj.pathname.split("/").filter(Boolean);
          imgKey = parts[parts.length - 1] || imgKey;
        } catch {
          imgKey = imgKey.split("?")[0].split("/").pop() || imgKey;
        }
      }
      if (imgKey) {
        updateData.image = imgKey;
      } else {
        delete updateData.image;
      }
    }

    const [updated] =
      await db
        .update(products)
        .set(updateData)
        .where(
          eq(
            products.id,
            id,
          ),
        )
        .returning();

    const { image: resolvedImage, imageKey } =
      await this.resolveImageUrl(updated.image);

    return {
      success: true,

      message:
        "Product updated successfully.",

      product: {
        ...updated,

        imageKey,

        image: resolvedImage,
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