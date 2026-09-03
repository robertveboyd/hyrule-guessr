import "server-only";

import { auth } from "@/lib/auth";

export async function getSessionIdHash(): Promise<string | null> {
  const session = await auth();
  return typeof session?.sessionIdHash === "string"
    ? session.sessionIdHash
    : null;
}
