import { z, type ZodType } from "zod";

const encoder = new TextEncoder();

export const JOIN_TOKEN_TTL_SECONDS = 120;

const joinTokenHeaderSchema = z.object({
  alg: z.literal("HS256"),
});

const joinTokenClaimsSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  exp: z.number(),
});

export type JoinTokenClaims = z.infer<typeof joinTokenClaimsSchema>;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let out = 0;
  for (let i = 0; i < left.byteLength; i++) out |= left[i] ^ right[i];
  return out === 0;
}

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(mac);
}

function decodeJson(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function parseWithSchema<S extends ZodType>(
  text: string,
  schema: S,
): z.infer<S> | null {
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function mintJoinToken(
  secret: string,
  userId: string,
  sessionId: string,
  now = Date.now(),
): Promise<string> {
  const header = bytesToBase64Url(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })),
  );
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        userId,
        sessionId,
        exp: Math.floor(now / 1000) + JOIN_TOKEN_TTL_SECONDS,
      } satisfies JoinTokenClaims),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = bytesToBase64Url(await hmacSign(secret, signingInput));
  return `${signingInput}.${signature}`;
}

export async function verifyJoinToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<JoinTokenClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const parsedHeader = parseWithSchema(
    decodeJson(base64UrlToBytes(header)),
    joinTokenHeaderSchema,
  );
  if (!parsedHeader) return null;

  const signingInput = `${header}.${payload}`;
  const expected = await hmacSign(secret, signingInput);
  const actual = base64UrlToBytes(signature);
  if (!timingSafeEqual(expected, actual)) return null;

  const claims = parseWithSchema(
    decodeJson(base64UrlToBytes(payload)),
    joinTokenClaimsSchema,
  );
  if (!claims) return null;
  if (claims.exp < Math.floor(now / 1000)) return null;
  return claims;
}

export function secretsEqual(left: string, right: string): boolean {
  return timingSafeEqual(encoder.encode(left), encoder.encode(right));
}
