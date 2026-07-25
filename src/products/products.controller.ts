import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";

import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";

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
}