import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";

import { AgenciesService } from "./agencies.service";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("agencies")
export class AgenciesController {
  constructor(
    private readonly agenciesService: AgenciesService,
  ) {}

  // ==========================================
  // ALL APPROVED AGENCIES
  // ==========================================

  @Get()
  findAll() {
    return this.agenciesService.findAll();
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