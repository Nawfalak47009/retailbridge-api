import {
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
} from "class-validator";

export class CreateDeliverySlotDto {
  @IsUUID()
  @IsNotEmpty()
  agencyId!: string;

  @IsUUID()
  @IsNotEmpty()
  shopId!: string;

  @IsNotEmpty()
  day!: string;

  @IsNotEmpty()
  startTime!: string;

  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  @Min(1)
  maxOrders!: number;
}