import {
  IsNotEmpty,
  IsUUID,
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
}