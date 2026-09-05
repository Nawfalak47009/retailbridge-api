import { Global, Module } from "@nestjs/common";
import { PushNotificationsService } from "./push-notifications.service";

@Global()
@Module({
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class NotificationsModule {}
