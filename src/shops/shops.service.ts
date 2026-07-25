import { Injectable } from "@nestjs/common";

@Injectable()
export class ShopsService {
  async submit(dto: any) {
    console.log(dto);

    return {
      success: true,
      message:
        "Documents submitted successfully.",
    };
  }

  async status(id: string) {
    return {
      id,
      status: "PENDING",
      documents: {
        aadhaar: true,
        shopPhoto: true,
      },
    };
  }
}