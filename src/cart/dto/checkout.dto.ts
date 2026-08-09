import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { Type } from "class-transformer";

export class CheckoutAgencyDto {
  @IsString()
  agencyId!: string;
}

export class CheckoutDto {
  @IsString()
  deliveryAddress!: string;

  @IsString()
  deliveryPincode!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutAgencyDto)
  orders!: CheckoutAgencyDto[];
}