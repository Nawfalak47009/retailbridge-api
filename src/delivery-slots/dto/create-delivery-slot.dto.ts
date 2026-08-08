import {
  IsInt,
  IsNotEmpty,
  IsString,
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

  @IsString()
  @IsNotEmpty()
  day!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  @Min(1)
  maxOrders!: number;
}