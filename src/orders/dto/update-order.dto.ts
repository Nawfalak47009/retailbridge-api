import {
  IsOptional,
  IsString,
  IsIn,
} from "class-validator";

export class UpdateOrderDto {
  @IsString()
  @IsIn([
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "SCHEDULED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ])
  status!:
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "SCHEDULED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";

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