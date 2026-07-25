import { Module } from '@nestjs/common';
import { AgencyShopsController } from './agency-shops.controller';
import { AgencyShopsService } from './agency-shops.service';

@Module({
  controllers: [
    AgencyShopsController,
  ],
  providers: [
    AgencyShopsService,
  ],
})
export class AgencyShopsModule {}
