import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AgencyShopsService } from "./agency-shops.service";

import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";
import { UpdateAgencyShopDto } from "./dto/update-agency-shop.dto";

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
  // Create Grocery Shop
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
    return this.agencyShopsService.createShop(
      user.id,
      dto,
    );
  }

  // =====================================
  // My Grocery Shops
  // =====================================

  @Get("my")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  getMyShops(
    @CurrentUser() user: JwtUser,
  ) {
    return this.agencyShopsService.getMyShops(
      user.id,
    );
  }

  // =====================================
  // Update Shop
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
    dto: UpdateAgencyShopDto,
  ) {
    return this.agencyShopsService.updateShop(
      user.id,
      id,
      dto,
    );
  }

  // =====================================
  // Delete Shop
  // =====================================

  @Delete(":id")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  delete(
    @CurrentUser() user: JwtUser,
    @Param("id")
    id: string,
  ) {
    return this.agencyShopsService.deleteShop(
      user.id,
      id,
    );
  }
}