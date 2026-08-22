import {
  IsNotEmpty,
  IsString,
} from "class-validator";

export class UpdateAgencyProfileDto {
  @IsString()
  @IsNotEmpty()
  agencyName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}