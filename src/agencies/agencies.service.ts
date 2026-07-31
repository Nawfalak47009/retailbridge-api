import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  agencies,
  agencyProfiles,
  users,
} from "../db/schema";

@Injectable()
export class AgenciesService {
  async findAll() {
    const agencyList =
      await db.query.agencies.findMany();

    const result: {
  id: string;
  agencyName: string;
  ownerName: string;
  phone: string;
  address: string;
  logo: string;
  description: string;
}[] = [];

    for (const agency of agencyList) {
      const user =
        await db.query.users.findFirst({
          where: eq(
            users.id,
            agency.userId,
          ),
        });

      // Only approved agencies
      if (
        !user ||
        user.status !== "APPROVED"
      ) {
        continue;
      }

      const profile =
        await db.query.agencyProfiles.findFirst({
          where: eq(
            agencyProfiles.agencyId,
            agency.id,
          ),
        });

      result.push({
        id: agency.id,
        agencyName:
          agency.agencyName,
        ownerName:
          agency.ownerName,
        phone:
          agency.phone,
        address:
          profile?.address ?? "",
        logo:
          profile?.logo ?? "",
        description:
          profile?.description ?? "",
      });
    }

    return result;
  }
}