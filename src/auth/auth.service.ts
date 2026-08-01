import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";

import * as bcrypt from "bcrypt";

import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  users,
  agencies,
  shops,
} from "../db/schema";

import { RegisterAgencyDto } from "./dto/register-agency.dto";
import { RegisterShopDto } from "./dto/register-shop.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  // =========================
  // REGISTER AGENCY
  // =========================

  async registerAgency(
    dto: RegisterAgencyDto,
  ) {
    const existingUser =
      await db.query.users.findFirst({
        where: eq(
          users.email,
          dto.email,
        ),
      });

    if (existingUser) {
      throw new BadRequestException(
        "Email already exists.",
      );
    }

    const hashed =
      await bcrypt.hash(
        dto.password,
        12,
      );

    const [user] = await db
      .insert(users)
      .values({
        email: dto.email,
        password: hashed,
        role: "AGENCY",
      })
      .returning();

    await db
      .insert(agencies)
      .values({
        userId: user.id,
        agencyName:
          dto.agencyName,
        ownerName:
          dto.ownerName,
        phone:
          dto.phone,
      });

    return {
      success: true,
      message:
        "Agency registered successfully. Waiting for admin approval.",
      id: user.id,
    };
  }

  // =========================
  // REGISTER SHOP
  // =========================

  async registerShop(
    dto: RegisterShopDto,
  ) {
    const existingUser =
      await db.query.users.findFirst({
        where: eq(
          users.email,
          dto.email,
        ),
      });

    if (existingUser) {
      throw new BadRequestException(
        "Email already exists.",
      );
    }

    const hashed =
      await bcrypt.hash(
        dto.password,
        12,
      );

    const [user] = await db
      .insert(users)
      .values({
        email: dto.email,
        password: hashed,
        role: "SHOP",
      })
      .returning();

    await db
      .insert(shops)
      .values({
        userId: user.id,
        shopName:
          dto.shopName,
        ownerName:
          dto.ownerName,
        phone:
          dto.phone,
        address:
          dto.address,
        pincode:
          dto.pincode,
        category:
          dto.category,
      });

    return {
      success: true,
      message:
        "Shop registered successfully. Waiting for admin approval.",
      id: user.id,
    };
  }

 // =========================
// LOGIN
// =========================

async login(dto: LoginDto) {
  const user =
    await db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

  if (!user) {
    throw new UnauthorizedException(
      "Invalid credentials.",
    );
  }

  if (user.status !== "APPROVED") {
    throw new UnauthorizedException(
      "Your account is pending approval.",
    );
  }

  const valid = await bcrypt.compare(
    dto.password,
    user.password,
  );

  if (!valid) {
    throw new UnauthorizedException(
      "Invalid credentials.",
    );
  }

  // Find Agency or Shop ID
  let agencyId: string | null = null;
  let shopId: string | null = null;

  if (user.role === "AGENCY") {
    const agency =
      await db.query.agencies.findFirst({
        where: eq(
          agencies.userId,
          user.id,
        ),
      });

    agencyId = agency?.id ?? null;
  }

  if (user.role === "SHOP") {
    const shop =
      await db.query.shops.findFirst({
        where: eq(
          shops.userId,
          user.id,
        ),
      });

    shopId = shop?.id ?? null;
  }

  const token =
    await this.jwtService.signAsync({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  return {
    success: true,

    accessToken: token,

    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,

      agencyId,
      shopId,
    },
  };
}
}