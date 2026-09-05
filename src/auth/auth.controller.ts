import {
  Body,
  Controller,
  Post,
  Req,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { AuthService } from "./auth.service";
import { PushNotificationsService } from "../notifications/push-notifications.service";

import { LoginDto } from "./dto/login.dto";
import { RegisterAgencyDto } from "./dto/register-agency.dto";
import { RegisterShopDto } from "./dto/register-shop.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post("agency/register")
  registerAgency(
    @Body()
    dto: RegisterAgencyDto,
  ) {
    return this.authService.registerAgency(
      dto,
    );
  }

  @Post("shop/register")
  registerShop(
    @Body()
    dto: RegisterShopDto,
  ) {
    return this.authService.registerShop(
      dto,
    );
  }

  @Post("login")
  login(
    @Body()
    dto: LoginDto,
  ) {
    return this.authService.login(
      dto,
    );
  }

  @Post("push-token")
  async savePushToken(
    @Req() req: any,
    @Body() body: { pushToken: string; userId?: string },
  ) {
    let targetUserId = body.userId;
    if (!targetUserId && req.headers?.authorization) {
      try {
        const raw = req.headers.authorization;
        const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
        const decoded = this.jwtService.decode(token) as any;
        if (decoded?.id || decoded?.sub) {
          targetUserId = decoded.id || decoded.sub;
        }
      } catch {}
    }
    if (!targetUserId) {
      return { success: false, message: "No target user specified" };
    }
    return this.pushNotificationsService.savePushToken(targetUserId, body.pushToken);
  }
}