import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";

import { OrdersService } from "./orders.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateOrderDto,
  ) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get("agency/:agencyId")
  findByAgency(
    @Param("agencyId")
    agencyId: string,
  ) {
    return this.ordersService.findByAgency(
      agencyId,
    );
  }

  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {
    return this.ordersService.findOne(id);
  }

  @Get("shop/:shopId")
findByShop(
  @Param("shopId")
  shopId: string,
) {
  return this.ordersService.findByShop(
    shopId,
  );
}

  @Patch(":id")
  update(
    @Param("id")
    id: string,

    @Body()
    dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      dto,
    );
  }
}

