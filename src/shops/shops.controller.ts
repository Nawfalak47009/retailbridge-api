import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
}