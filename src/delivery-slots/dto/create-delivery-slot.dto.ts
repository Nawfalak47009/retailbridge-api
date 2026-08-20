import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
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

  @IsDateString()
  @IsNotEmpty()
  deliveryDate!: string;
}