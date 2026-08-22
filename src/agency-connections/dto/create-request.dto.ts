import {
  IsIn,
  IsNotEmpty,
  IsUUID,
} from "class-validator";

export class CreateRequestDto {
  @IsUUID()
  @IsNotEmpty()
  agencyId!: string;

  @IsUUID()
  @IsNotEmpty()
  shopId!: string;

  @IsIn(["AGENCY", "SHOP"])
  requestedBy!: "AGENCY" | "SHOP";
}