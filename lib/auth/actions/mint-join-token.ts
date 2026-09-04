"use server";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { mintJoinToken } from "@/party/join-token";

export async function mintJoinTokenAction(
  clientSessionId: string | null,
): Promise<string | null> {
  if (!config.sessionRoomSecret || !clientSessionId) return null;

  const session = await auth();
  const userId = session?.user?.id;
  if (typeof userId !== "string") return null;

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { sessionId: true },
  });
  if (row?.sessionId !== clientSessionId) return null;

  return mintJoinToken(config.sessionRoomSecret, userId, clientSessionId);
}
