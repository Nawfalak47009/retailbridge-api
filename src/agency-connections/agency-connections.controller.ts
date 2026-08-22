import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "@nestjs/passport";

import { AgencyConnectionsService } from "./agency-connections.service";
import { CreateRequestDto } from "./dto/create-request.dto";

@Controller("agency-connections")
@UseGuards(AuthGuard("jwt"))
export class AgencyConnectionsController {
  constructor(
    private readonly agencyConnectionsService: AgencyConnectionsService,
  ) {}

  // ==========================================
  // SEND REQUEST
  // ==========================================

  @Post("request")
  createRequest(
    @Body() dto: CreateRequestDto,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.createRequest(
      dto,
      req.user,
    );
  }

  // ==========================================
  // AGENCY INCOMING REQUESTS
  // ==========================================

  @Get("agency/:agencyId/incoming")
  getAgencyIncomingRequests(
    @Param("agencyId") agencyId: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.getAgencyIncomingRequests(
      agencyId,
      req.user,
    );
  }

  // ==========================================
  // SHOP INCOMING REQUESTS
  // ==========================================

  @Get("shop/:shopId/incoming")
  getShopIncomingRequests(
    @Param("shopId") shopId: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.getShopIncomingRequests(
      shopId,
      req.user,
    );
  }

  // ==========================================
  // ACCEPT
  // ==========================================

  @Patch(":id/accept")
  acceptRequest(
    @Param("id") id: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.acceptRequest(
      id,
      req.user,
    );
  }

  // ==========================================
  // REJECT
  // ==========================================

  @Patch(":id/reject")
  rejectRequest(
    @Param("id") id: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.rejectRequest(
      id,
      req.user,
    );
  }

  // ==========================================
  // SHOP → MY AGENCIES
  // ==========================================

  @Get("my-agencies/:shopId")
  getMyAgencies(
    @Param("shopId") shopId: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.getMyAgencies(
      shopId,
      req.user,
    );
  }

  // ==========================================
  // AGENCY → MY SHOPS
  // ==========================================

  @Get("my-shops/:agencyId")
  getMyShops(
    @Param("agencyId") agencyId: string,
    @Req() req: any,
  ) {
    return this.agencyConnectionsService.getMyShops(
      agencyId,
      req.user,
    );
  }
}