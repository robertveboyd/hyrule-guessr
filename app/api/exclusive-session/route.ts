import { isExclusiveSessionActive } from "@/lib/auth/check-exclusive-session";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const clientSessionId =
    body &&
    typeof body === "object" &&
    "clientSessionId" in body &&
    typeof body.clientSessionId === "string"
      ? body.clientSessionId
      : null;

  const active = await isExclusiveSessionActive(clientSessionId);
  return Response.json({ active });
}
