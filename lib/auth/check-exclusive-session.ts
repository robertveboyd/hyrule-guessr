import "server-only";

import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionIdsEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

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
