import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "@nestjs/passport";

import {
  DeliverySlotsService,
} from "./delivery-slots.service";

import {
  CreateDeliverySlotDto,
} from "./dto/create-delivery-slot.dto";

@Controller("delivery-slots")
@UseGuards(AuthGuard("jwt"))
export class DeliverySlotsController {

  constructor(
    private readonly deliverySlotsService: DeliverySlotsService,
  ) {}

  // ==========================================
  // AGENCY → CREATE SLOT
  // ==========================================

  @Post()
  create(
    @Body()
    dto: CreateDeliverySlotDto,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.create(
      dto,
      req.user,
    );
  }

  // ==========================================
  // AGENCY → ALL MY SLOTS
  // ==========================================

  @Get("agency/:agencyId")
  findByAgency(
    @Param("agencyId")
    agencyId: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.findByAgency(
      agencyId,
      req.user,
    );
  }

  // ==========================================
  // AGENCY → ONE CONNECTED SHOP'S SLOTS
  // ==========================================

  @Get("agency/:agencyId/shop/:shopId")
  findByAgencyShop(
    @Param("agencyId")
    agencyId: string,

    @Param("shopId")
    shopId: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.findByAgencyShop(
      agencyId,
      shopId,
      req.user,
    );
  }

  // ==========================================
  // SHOP → ITS DELIVERY SLOTS
  // ==========================================

  @Get("shop/:shopId")
  findByShop(
    @Param("shopId")
    shopId: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.findByShop(
      shopId,
      req.user,
    );
  }

  // ==========================================
  // AGENCY → DELETE SLOT
  // ==========================================

  @Delete(":id")
  remove(
    @Param("id")
    id: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.remove(
      id,
      req.user,
    );
  }
}