import { Module } from "@nestjs/common";

import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [
    DocumentsModule,
  ],

  controllers: [
    OrdersController,
  ],

  providers: [
    OrdersService,
  ],
})
export class OrdersModule {}