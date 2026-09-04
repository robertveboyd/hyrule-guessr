import "server-only";

import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { SESSION_ID_RE, sessionIdsEqual } from "@/lib/auth/session-id";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function requireExclusiveSession(
  clientSessionId: string | null,
): Promise<{ id: string } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (typeof userId !== "string") return null;
  if (!clientSessionId || !SESSION_ID_RE.test(clientSessionId)) return null;

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { sessionId: true },
  });
  if (typeof row?.sessionId !== "string") return null;
  if (!sessionIdsEqual(row.sessionId, clientSessionId)) return null;

  return { id: userId };
}

export async function isExclusiveSessionActive(
  clientSessionId: string | null,
): Promise<boolean> {
  return (await requireExclusiveSession(clientSessionId)) !== null;
}
