import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateAgencyProfileDto {
  @IsString()
  @IsOptional()
  agencyName?: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  logo?: string;
}
