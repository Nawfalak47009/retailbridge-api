import { Module } from "@nestjs/common";

import {
  DeliverySlotsController,
} from "./delivery-slots.controller";

import {
  DeliverySlotsService,
} from "./delivery-slots.service";

@Module({
  controllers: [
    DeliverySlotsController,
  ],

  providers: [
    DeliverySlotsService,
  ],
})
export class DeliverySlotsModule {}