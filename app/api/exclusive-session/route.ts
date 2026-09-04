import { z } from "zod";

import { isExclusiveSessionActive } from "@/lib/auth/check-exclusive-session";

const bodySchema = z.object({
  clientSessionId: z.string().nullable(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const clientSessionId = parsed.success ? parsed.data.clientSessionId : null;
  const active = await isExclusiveSessionActive(clientSessionId);
  return Response.json({ active });
}
