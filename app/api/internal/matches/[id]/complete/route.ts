import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { completeMatch } from "@/lib/match/engine";
import { secretsEqual } from "@/party/join-token";
import { z } from "zod";

const completeSchema = z.object({
  winnerUserId: z.string().nullable(),
  healthA: z.number(),
  healthB: z.number(),
  rounds: z.array(
    z.object({
      roundIndex: z.number(),
      stillId: z.string(),
      multiplier: z.number(),
      guessA: z.object({ x: z.number(), z: z.number() }).nullable(),
      guessB: z.object({ x: z.number(), z: z.number() }).nullable(),
      scoreA: z.number(),
      scoreB: z.number(),
      damage: z.number(),
      loserId: z.string().nullable(),
      resolvedAt: z.number(),
    }),
  ),
});

function authorized(request: Request) {
  const secret = config.matchRoomSecret;
  const header = request.headers.get("Authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return Boolean(secret && provided && secretsEqual(provided, secret));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!authorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const parsed = completeSchema.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Bad Request", { status: 400 });
  }
  await completeMatch(id, parsed.data);
  return new NextResponse(null, { status: 204 });
}
