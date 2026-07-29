import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";

import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(dto);
  }

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
  update(
    @Param("id")
    id: string,
    @Body()
    dto: UpdateProductDto,
  ) {
    return this.productsService.update(
      id,
      dto,
    );
  }

  @Delete(":id")
  remove(
    @Param("id")
    id: string,
  ) {
    return this.productsService.remove(id);
  }
}