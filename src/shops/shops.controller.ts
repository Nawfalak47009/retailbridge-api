import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from "@nestjs/common";

import { ShopsService } from "./shops.service";

import { SubmitShopDocumentsDto } from "./dto/submit-shop-documents.dto";

@Controller("shops")
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService
  ) {}

  @Patch("submit")
  submit(
    @Body()
    dto: SubmitShopDocumentsDto
  ) {
    return this.shopsService.submit(
      dto
    );
  }

  @Get("status/:id")
  status(
    @Param("id")
    id: string
  ) {
    return this.shopsService.status(
      id
    );
  }
}