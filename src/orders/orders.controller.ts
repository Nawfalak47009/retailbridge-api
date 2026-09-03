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

  // =====================================
  // SHOP - PLACE ORDER
  // =====================================

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

  // =====================================
  // ADMIN - ALL ORDERS
  // =====================================

  @Get()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("ADMIN")
  findAll() {
    return this.ordersService.findAll();
  }

  // =====================================
  // AGENCY - MY ORDERS
  // =====================================

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

  // =====================================
  // SHOP - MY ORDERS
  // =====================================

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

  // =====================================
  // SHOP - MY ORDERS WITH SPECIFIC AGENCY
  // =====================================

  @Get("shop/agency/:agencyId")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  findByShopAndAgency(
    @CurrentUser() user: JwtUser,
    @Param("agencyId") agencyId: string,
  ) {
    return this.ordersService.findByShopAndAgency(
      user.id,
      agencyId,
    );
  }

  // =====================================
  // SINGLE ORDER
  // =====================================

 @Get(":id")
@UseGuards(
  JwtAuthGuard,
)
findOne(
  @CurrentUser() user: JwtUser,
  @Param("id")
  id: string,
) {
  return this.ordersService.findOne(
    user.id,
    user.role,
    id,
  );
}

  // =====================================
  // AGENCY - UPDATE DELIVERY STATUS
  // =====================================

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