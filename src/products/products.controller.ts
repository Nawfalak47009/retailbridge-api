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
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtUser } from "../auth/interfaces/jwt-user.interface";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get("agency/:agencyId")
  findByAgency(
    @Param("agencyId")
    agencyId: string,
  ) {
    return this.productsService.findByAgency(
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

 @Patch(":id")
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("AGENCY")
update(
  @CurrentUser() user: JwtUser,
  @Param("id") id: string,
  @Body() dto: UpdateProductDto,
) {
  return this.productsService.update(
    user.id,
    id,
    dto,
  );
}

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

  @Delete(":id")
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("AGENCY")
remove(
  @CurrentUser() user: JwtUser,
  @Param("id") id: string,
) {
  return this.productsService.remove(
    user.id,
    id,
  );
}
}

