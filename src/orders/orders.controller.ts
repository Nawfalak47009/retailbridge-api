import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { OrdersService } from "./orders.service";

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  // ===========================
  // SHOP - CREATE ORDER
  // ===========================

  @Post()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateOrderDto,
  ) {
    return this.ordersService.create(
      user.id,
      dto,
    );
  }

  // ===========================
  // ADMIN
  // ===========================

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  // ===========================
  // AGENCY ORDERS
  // ===========================

  @Get("agency")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  findByAgency(
    @CurrentUser() user: JwtUser,
  ) {
    return this.ordersService.findByAgency(
      user.id,
    );
  }

  // ===========================
  // SHOP ORDERS
  // ===========================

  @Get("shop")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  findByShop(
    @CurrentUser() user: JwtUser,
  ) {
    return this.ordersService.findByShop(
      user.id,
    );
  }

  // ===========================
  // SINGLE ORDER
  // ===========================

  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {
    return this.ordersService.findOne(
      id,
    );
  }

  // ===========================
  // UPDATE STATUS
  // ===========================

  @Patch(":id")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  update(
    @CurrentUser() user: JwtUser,
    @Param("id")
    id: string,

    @Body()
    dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateStatus(
      user.id,
      id,
      dto,
    );
  }
}