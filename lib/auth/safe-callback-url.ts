const ORIGIN = "https://hyrule-guessr.invalid";

export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(value, ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== ORIGIN) return fallback;

  const path = parsed.pathname;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path === "/login" || path.startsWith("/login/")) return fallback;

  return `${path}${parsed.search}`;
}
