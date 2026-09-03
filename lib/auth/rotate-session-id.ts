import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function rotateSessionId(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();

  await db
    .update(users)
    .set({ sessionId })
    .where(eq(users.id, userId));

  return sessionId;
}
