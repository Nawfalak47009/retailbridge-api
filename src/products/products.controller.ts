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
    console.log("========== PRODUCT DTO ==========");
    console.log(dto);
    console.log("Agency ID:", dto.agencyId);
    console.log("Name:", dto.name);
    console.log("Image:", dto.image);
    console.log("Image Type:", typeof dto.image);
    console.log("Unit:", dto.unit);
    console.log("Quantity Per Unit:", dto.quantityPerUnit);
    console.log("Price:", dto.price);
    console.log("Stock:", dto.stock);

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