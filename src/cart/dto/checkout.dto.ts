import {
  IsOptional,
  IsString,
} from "class-validator";

export class CheckoutDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}