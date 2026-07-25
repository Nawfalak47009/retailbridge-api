import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";

import { ProfilesService } from "./profiles.service";

import { CreateAgencyProfileDto } from "./dto/create-agency-profile.dto";
import { CreateShopProfileDto } from "./dto/create-shop-profile.dto";

@Controller("profiles")
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
  ) {}

  // Agency

  @Post("agency")
  createAgencyProfile(
    @Body()
    dto: CreateAgencyProfileDto,
  ) {
    return this.profilesService.createAgencyProfile(
      dto,
    );
  }

  @Get("agency/:id")
  getAgencyProfile(
    @Param("id")
    id: string,
  ) {
    return this.profilesService.getAgencyProfile(
      id,
    );
  }

  // Shop

  @Post("shop")
  createShopProfile(
    @Body()
    dto: CreateShopProfileDto,
  ) {
    return this.profilesService.createShopProfile(
      dto,
    );
  }

  @Get("shop/:id")
  getShopProfile(
    @Param("id")
    id: string,
  ) {
    return this.profilesService.getShopProfile(
      id,
    );
  }
}