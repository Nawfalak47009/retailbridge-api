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
import { ProfilesModule } from './profiles/profiles.module';
import { CartModule } from './cart/cart.module';
import { AgencyConnectionsModule } from './agency-connections/agency-connections.module';
import { DeliverySlotsModule } from './delivery-slots/delivery-slots.module';


@Module({
  imports: [AuthModule, UsersModule, AgenciesModule, ShopsModule, DocumentsModule, AdminModule, ProductsModule, OrdersModule, ProfilesModule, CartModule, AgencyConnectionsModule, DeliverySlotsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
