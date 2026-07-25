import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  orders,
  orderItems,
} from "../db/schema";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Injectable()
export class OrdersService {
  async create(dto: CreateOrderDto) {
    const [order] = await db
      .insert(orders)
      .values({
        agencyId: dto.agencyId,
        shopId: dto.shopId,
        status: "PENDING",
        remarks: dto.remarks,
      })
      .returning();

    return order;
  }

  async findAll() {
    return db.select().from(orders);
  }

  async findByAgency(
    agencyId: string,
  ) {
    return db
      .select()
      .from(orders)
      .where(eq(orders.agencyId, agencyId));
  }

  async findOne(id: string) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));

    if (!order) {
      throw new NotFoundException(
        "Order not found",
      );
    }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    return {
      ...order,
      items,
    };
  }

  async updateStatus(
  id: string,
  dto: UpdateOrderDto,
) {
  const [updated] = await db
    .update(orders)
    .set({
      status: dto.status,
      deliveryPerson: dto.deliveryPerson,
    })
    .where(eq(orders.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundException(
      "Order not found",
    );
  }

  return updated;
}
}