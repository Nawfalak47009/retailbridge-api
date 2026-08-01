import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
} from "@nestjs/common";

import { ProfilesService } from "./profiles.service";

import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { CreateShopProfileDto } from "./dto/create-shop-profile.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("profiles")
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
  ) {}

  // =====================================
  // AGENCY PROFILE
  // =====================================

  @Post("agency")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  createAgencyProfile(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateAgencyProfileDto,
  ) {
    return this.profilesService.createAgencyProfile(
      user.id,
      dto,
    );
  }

  @Get("agency")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  getAgencyProfile(
    @CurrentUser() user: JwtUser,
  ) {
    return this.profilesService.getAgencyProfile(
      user.id,
    );
  }

  @Patch("agency")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  updateAgencyProfile(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateAgencyProfileDto,
  ) {
    return this.profilesService.updateAgencyProfile(
      user.id,
      dto,
    );
  }

  // =====================================
  // SHOP PROFILE
  // =====================================

  @Post("shop")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  createShopProfile(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateShopProfileDto,
  ) {
    return this.profilesService.createShopProfile(
      user.id,
      dto,
    );
  }

  @Get("shop")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  getShopProfile(
    @CurrentUser() user: JwtUser,
  ) {
    return this.profilesService.getShopProfile(
      user.id,
    );
  }

  @Patch("shop")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("SHOP")
  updateShopProfile(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateShopProfileDto,
  ) {
    return this.profilesService.updateShopProfile(
      user.id,
      dto,
    );
  }
}