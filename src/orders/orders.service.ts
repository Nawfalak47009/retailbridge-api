import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { orders } from "../db/schema";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  // Create Order
  async create(dto: CreateOrderDto) {
    const [order] = await db
      .insert(orders)
      .values(dto)
      .returning();

    return {
      success: true,
      message: "Order placed successfully.",
      order,
    };
  }

  // Get All Orders
  async findAll() {
    return db.query.orders.findMany({
      orderBy: (orders, { desc }) => [
        desc(orders.createdAt),
      ],
    });
  }

  // Get Orders By Agency
  async findByAgency(
    agencyId: string,
  ) {
    return db.query.orders.findMany({
      where: eq(
        orders.agencyId,
        agencyId,
      ),
      orderBy: (orders, { desc }) => [
        desc(orders.createdAt),
      ],
    });
  }

  // Get Single Order
  async findOne(id: string) {
    return db.query.orders.findFirst({
      where: eq(
        orders.id,
        id,
      ),
    });
  }

  // Update Status
  async updateStatus(
    id: string,
    dto: UpdateOrderDto,
  ) {
    await db
      .update(orders)
      .set({
        status: dto.status,
        deliveryPerson:
          dto.deliveryPerson,
        deliveredAt:
          dto.status ===
          "DELIVERED"
            ? new Date()
            : undefined,
      })
      .where(
        eq(
          orders.id,
          id,
        ),
      );

    return {
      success: true,
      message:
        "Order updated successfully.",
    };
  }
}