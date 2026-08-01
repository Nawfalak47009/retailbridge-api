import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AgencyShopsService } from "./agency-shops.service";
import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("agency-shops")
export class AgencyShopsController {
  constructor(
    private readonly agencyShopsService: AgencyShopsService,
  ) {}

  // =====================================
  // Connect Shop to Agency
  // =====================================

  @Post()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateAgencyShopDto,
  ) {
    return this.agencyShopsService.create(
      user.id,
      dto,
    );
  }

  // =====================================
  // My Connected Shops
  // =====================================

  @Get("my")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  findByAgency(
    @CurrentUser() user: JwtUser,
  ) {
    return this.agencyShopsService.findByAgency(
      user.id,
    );
  }

  // =====================================
  // My Connected Agencies
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
    return this.agencyShopsService.findByShop(
      user.id,
    );
  }

  // =====================================
  // Admin
  // =====================================

  @Get()
  findAll() {
    return this.agencyShopsService.findAll();
  }
}