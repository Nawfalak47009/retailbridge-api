import { Module } from "@nestjs/common";

import { ShopsController } from "./shops.controller";
import { ShopsService } from "./shops.service";

import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [
    DocumentsModule,
  ],

  controllers: [
    ShopsController,
  ],

  providers: [
    ShopsService,
  ],
})
export class ShopsModule {}