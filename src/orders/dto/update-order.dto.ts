import {
  IsOptional,
  IsString,
  IsIn,
} from "class-validator";

export class UpdateOrderDto {
  @IsString()
  @IsIn([
    "PENDING",
    "DELIVERY_SCHEDULE_PENDING",
    "ACCEPTED",
    "REJECTED",
    "SCHEDULED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ])
  status!:
    | "PENDING"
    | "DELIVERY_SCHEDULE_PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "SCHEDULED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";

  // Delivery schedule selected by agency
  @IsOptional()
  @IsString()
  slotId?: string;

  @IsOptional()
  @IsString()
  trackingMessage?: string;

  @IsOptional()
  @IsString()
  deliveryPerson?: string;

  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;
}