import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";

import { ShopsService } from "./shops.service";

import { SubmitShopDocumentsDto } from "./dto/submit-shop-documents.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("shops")
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
  ) {}

  // =====================================
  // Submit Shop Documents
  // =====================================

  @Patch("submit")
  submit(
    @Body()
    dto: SubmitShopDocumentsDto,
  ) {
    return this.shopsService.submit(dto);
  }

  // =====================================
  // Shop Status
  // =====================================

  @Get("status/:id")
  status(
    @Param("id")
    id: string,
  ) {
    return this.shopsService.status(id);
  }

    // =====================================
  // Shop Profile
  // =====================================

  @Get("profile")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  profile(
    @CurrentUser() user: JwtUser,
  ) {
    return this.shopsService.profile(
      user.id,
    );
  }

  // =====================================
  // Update Shop Address & Store Details
  // =====================================

  @Patch("profile/address")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  updateAddress(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      address?: string;
      pincode?: string;
      shopName?: string;
      ownerName?: string;
      phone?: string;
      landmark?: string;
    },
  ) {
    return this.shopsService.updateAddress(
      user.id,
      body,
    );
  }

  // =====================================
  // Shop Dashboard (JWT)
  // =====================================

  @Get("dashboard")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  dashboard(
    @CurrentUser() user: JwtUser,
  ) {
    return this.shopsService.dashboard(
      user.id,
    );
  }

  // =====================================
// Frequently Bought Products
// =====================================

  @Get("frequently-bought")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  frequentlyBought(
    @CurrentUser() user: JwtUser,
  ) {
    return this.shopsService.frequentlyBought(
      user.id,
    );
  }

  // =====================================
  // Grocery Stores Leaderboard
  // =====================================

  @Get("leaderboard")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  leaderboard(
    @CurrentUser() user: JwtUser,
    @Query("period") period?: string,
  ) {
    return this.shopsService.getLeaderboard(
      user.id,
      period,
    );
  }

  // =====================================
  // Single Shop by ID
  // =====================================

  @Get(":id")
  findOne(
    @Param("id") id: string,
  ) {
    return this.shopsService.findOne(id);
  }
}

