import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";

import { AgenciesService } from "./agencies.service";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

import { UpdateAgencyProfileDto } from "./dto/update-agency-profile.dto";

@Controller("agencies")
export class AgenciesController {
  constructor(
    private readonly agenciesService: AgenciesService,
  ) {}

  // ==========================================
  // ALL APPROVED AGENCIES
  // ==========================================

  @Get()
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("SHOP")
findAll(
  @CurrentUser()
  user: any,
) {
  return this.agenciesService.findAll(
    user.id,
  );
}

  // ==========================================
  // AGENCY DASHBOARD
  // ==========================================

  @Get("dashboard")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  dashboard(
    @CurrentUser()
    user: any,
  ) {
    return this.agenciesService.dashboard(
      user.id,
    );
  }

  // ==========================================
  // UPDATE PROFILE
  // ==========================================

  @Patch("profile")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  updateProfile(
    @CurrentUser()
    user: any,

    @Body()
    body: UpdateAgencyProfileDto,
  ) {
    return this.agenciesService.updateProfile(
      user.id,
      body,
    );
  }

  // ==========================================
  // SINGLE AGENCY
  // ==========================================

  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {
    return this.agenciesService.findOne(id);
  }
}