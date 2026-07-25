import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgenciesModule } from './agencies/agencies.module';
import { ShopsModule } from './shops/shops.module';
import { DocumentsModule } from './documents/documents.module';
import { AdminModule } from './admin/admin.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AgencyShopsModule } from './agency-shops/agency-shops.module';
import { ProfilesModule } from './profiles/profiles.module';


@Module({
  imports: [AuthModule, UsersModule, AgenciesModule, ShopsModule, DocumentsModule, AdminModule, ProductsModule, OrdersModule, AgencyShopsModule, ProfilesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
