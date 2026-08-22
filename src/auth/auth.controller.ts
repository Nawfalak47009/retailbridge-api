import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";

import { AuthService } from "./auth.service";

import { LoginDto } from "./dto/login.dto";
import { RegisterAgencyDto } from "./dto/register-agency.dto";
import { RegisterShopDto } from "./dto/register-shop.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
}