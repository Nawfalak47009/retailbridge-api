import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class CreateAgencyShopDto {
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @IsString()
  @IsNotEmpty()
  deliveryDay!: string;

  @IsString()
  @IsNotEmpty()
  deliverySlot!: string;
}