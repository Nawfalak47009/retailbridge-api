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
  // AGENCY → CREATE DELIVERY DAY
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
  // AGENCY → ALL MY DELIVERY DAYS
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
  // AGENCY → ONE SHOP'S DELIVERY DAYS
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
  // SHOP → ACTIVE SLOT ORDERING REMINDERS
  // ==========================================

  @Get("shop/:shopId/reminders")
  findRemindersByShop(
    @Param("shopId")
    shopId: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.getShopSlotReminders(
      shopId,
      req.user,
    );
  }

  @Get("reminders/shop/:shopId")
  findRemindersByShopAlt(
    @Param("shopId")
    shopId: string,

    @Req()
    req: any,
  ) {
    return this.deliverySlotsService.getShopSlotReminders(
      shopId,
      req.user,
    );
  }

  // ==========================================
  // SHOP → ITS DELIVERY DAYS
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
  // AGENCY → DELETE DELIVERY DAY
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