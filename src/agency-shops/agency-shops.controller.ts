import {
  Body,
  Controller,
  Get,
  Post,
} from "@nestjs/common";

import { AgencyShopsService } from "./agency-shops.service";

import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";

@Controller("agency-shops")
export class AgencyShopsController {
  constructor(
    private readonly agencyShopsService:
      AgencyShopsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateAgencyShopDto,
  ) {
    return this.agencyShopsService.create(
      dto,
    );
  }

  @Get()
  findAll() {
    return this.agencyShopsService.findAll();
  }
}