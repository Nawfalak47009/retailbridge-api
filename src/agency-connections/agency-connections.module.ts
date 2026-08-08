import { Module } from "@nestjs/common";

import {
  AgencyConnectionsController,
} from "./agency-connections.controller";

import {
  AgencyConnectionsService,
} from "./agency-connections.service";

@Module({
  controllers: [
    AgencyConnectionsController,
  ],

  providers: [
    AgencyConnectionsService,
  ],
})
export class AgencyConnectionsModule {}