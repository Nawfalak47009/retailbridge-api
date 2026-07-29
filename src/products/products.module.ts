import { Module } from "@nestjs/common";

import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [
    DocumentsModule,
  ],

  controllers: [
    ProductsController,
  ],

  providers: [
    ProductsService,
  ],
})
export class ProductsModule {}