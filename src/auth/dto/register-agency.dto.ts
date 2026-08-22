import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from "class-validator";

export class RegisterAgencyDto {
  @IsString()
  @IsNotEmpty()
  agencyName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^[0-9]{10}$/, {
    message:
      "Phone number must be 10 digits",
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  gst!: string;

  @IsString()
  @IsNotEmpty()
  pan!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  // NEW FIELD
  @IsOptional()
  @IsString()
  description?: string;

  @MinLength(8)
  password!: string;
}