import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";

import { SubmitDocumentsDto } from "./dto/submit-documents.dto";

@Injectable()
export class UsersService {
  async submit(
    dto: SubmitDocumentsDto,
  ) {
    await db
      .update(users)
      .set({
        aadhaar: dto.aadhaar,

        gst: dto.gst,

        pan: dto.pan,

        license:
          dto.license,

        status:
          "PENDING",
      })
      .where(
        eq(
          users.id,
          dto.userId,
        ),
      );

    return {
      success: true,
      message:
        "Documents submitted successfully.",
    };
  }

  async status(
    id: string,
  ) {
    const user =
      await db.query.users.findFirst({
        where: eq(
          users.id,
          id,
        ),
      });

    if (!user) {
      return {
        success: false,
        message:
          "User not found.",
      };
    }

    return {
      success: true,
      status:
        user.status,
    };
  }
}