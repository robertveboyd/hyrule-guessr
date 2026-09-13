import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { expireMatch } from "@/lib/match/engine";
import { secretsEqual } from "@/party/join-token";

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
  await expireMatch(id);
  return new NextResponse(null, { status: 204 });
}
