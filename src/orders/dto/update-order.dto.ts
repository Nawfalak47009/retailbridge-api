export class UpdateOrderDto {
  status!:
    | "PENDING"
    | "ACCEPTED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED";

  deliveryPerson?: string;
}