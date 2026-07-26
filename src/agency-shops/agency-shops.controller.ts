import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";

import { AgencyShopsService } from "./agency-shops.service";
import { CreateAgencyShopDto } from "./dto/create-agency-shop.dto";

@Controller("agency-shops")
export class AgencyShopsController {
  constructor(
    private readonly agencyShopsService: AgencyShopsService,
  ) {}

  @Post()
  create(
    @Body()
    dto: CreateAgencyShopDto,
  ) {
    return this.agencyShopsService.create(dto);
  }

  @Get()
  findAll() {
    return this.agencyShopsService.findAll();
  }

  @Get(":agencyId")
  findByAgency(
    @Param("agencyId")
    agencyId: string,
  ) {
    return this.agencyShopsService.findByAgency(
      agencyId,
    );
  }
}