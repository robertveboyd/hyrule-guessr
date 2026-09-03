import "server-only";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function isExclusiveSessionActive(
  clientSessionId: string | null,
): Promise<boolean> {
  const session = await auth();
  if (typeof session?.user?.id !== "string") {
    return false;
  }

  if (!clientSessionId) {
    return false;
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { sessionId: true },
  });

  return row?.sessionId === clientSessionId;
}
