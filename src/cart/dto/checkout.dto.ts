import {
  IsOptional,
  IsString,
} from "class-validator";

export class CheckoutDto {
  @IsString()
  deliveryAddress!: string;

  @IsString()
  deliveryPincode!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}