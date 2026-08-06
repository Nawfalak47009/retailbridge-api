import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  // =====================================
  // MY PRODUCTS (JWT)
  // =====================================

  @Get("my")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  findMine(
    @CurrentUser() user: JwtUser,
  ) {
    return this.productsService.findMine(
      user.id,
    );
  }

  // =====================================
  // PUBLIC
  // =====================================

  // =====================================
// PRODUCTS FOR SHOP
// =====================================

@Get()
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("SHOP")
findAll(
  @CurrentUser()
  user: JwtUser,
) {
  return this.productsService.findAll(
    user.id,
  );
}

@Get("agency/:agencyId")
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("SHOP")
findByAgency(
  @CurrentUser()
  user: JwtUser,

  @Param("agencyId")
  agencyId: string,
) {
  return this.productsService.findByAgency(
    user.id,
    agencyId,
  );
}
  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {
    return this.productsService.findOne(id);
  }

  // =====================================
  // CREATE
  // =====================================

  @Post()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: CreateProductDto,
  ) {
    return this.productsService.create(
      user.id,
      dto,
    );
  }

  // =====================================
  // UPDATE
  // =====================================

  @Patch(":id")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  update(
    @CurrentUser() user: JwtUser,
    @Param("id")
    id: string,
    @Body()
    dto: UpdateProductDto,
  ) {
    return this.productsService.update(
      user.id,
      id,
      dto,
    );
  }

  // =====================================
  // DELETE
  // =====================================

  @Delete(":id")
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
  )
  @Roles("AGENCY")
  remove(
    @CurrentUser() user: JwtUser,
    @Param("id")
    id: string,
  ) {
    return this.productsService.remove(
      user.id,
      id,
    );
  }
}