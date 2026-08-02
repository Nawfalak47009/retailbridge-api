import { Module } from "@nestjs/common";

import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [
    DocumentsModule,
  ],
  controllers: [
    CartController,
  ],
  providers: [
    CartService,
  ],
})
export class CartModule {}