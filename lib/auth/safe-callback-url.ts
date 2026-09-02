function pathnameOnly(path: string) {
  return path.split("?", 1)[0].split("#", 1)[0] ?? path;
}
  
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  const path = pathnameOnly(value);
  if (path === "/login" || path.startsWith("/login/")) return fallback;

  return path;
}