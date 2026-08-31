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
  agencyProfiles,
  shops,
  userSessions,
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

  // Create User
  const [user] = await db
    .insert(users)
    .values({
      email: dto.email,
      password: hashed,
      role: "AGENCY",
    })
    .returning();

  // Create Agency
  const [agency] = await db
    .insert(agencies)
    .values({
      userId: user.id,
      agencyName:
        dto.agencyName,
      ownerName:
        dto.ownerName,
      phone:
        dto.phone,
    })
    .returning();

  // Create Agency Profile
  await db
    .insert(agencyProfiles)
    .values({
      agencyId: agency.id,
      address:
        dto.address,
      gst:
        dto.gst,
      logo: "",
      description:
        dto.description ?? "",
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

  // Create User
  const [user] = await db
    .insert(users)
    .values({
      email: dto.email,
      password: hashed,
      role: "SHOP",
    })
    .returning();

  // Create independent Grocery Shop
  await db.insert(shops).values({
    userId: user.id,

    shopName: dto.shopName,

    ownerName: dto.ownerName,

    phone: dto.phone,

    address: dto.address,

    pincode: dto.pincode,
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
    const roleLabel = user.role === "AGENCY" ? "agency" : "grocery";
    throw new UnauthorizedException(
      `Your ${roleLabel} account is pending approval by admin. You will be able to log in once approved.`,
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

  // ==========================================================
  // AGENCY MULTI-MEMBER CONCURRENT LOGIN LIMIT (MAX 5 MEMBERS)
  // ==========================================================
  if (user.role === "AGENCY") {
    try {
      const activeSessions = await db.query.userSessions.findMany({
        where: eq(userSessions.userId, user.id),
        orderBy: (s, { asc }) => [asc(s.createdAt)],
      });

      // Keep strictly maximum 5 active members logged in at any time
      if (activeSessions.length >= 5) {
        const sessionsToRemove = activeSessions.slice(0, activeSessions.length - 4);
        for (const oldSession of sessionsToRemove) {
          await db.delete(userSessions).where(eq(userSessions.id, oldSession.id));
        }
      }

      // Record this login session
      await db.insert(userSessions).values({
        userId: user.id,
        token: token.slice(-50),
        deviceInfo: "Agency Mobile/Web Session",
      });
    } catch (sessionErr) {
      console.log("Agency session limit tracking error:", sessionErr);
    }
  }

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