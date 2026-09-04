import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export const LOGIN_PATH = "/login";

/** Set by `proxy.ts` so Server Components can rebuild `callbackUrl`. */
export const CALLBACK_PATH_HEADER = "x-hyrule-path";

export function loginPathWithCallback(raw: unknown): string {
  const callbackUrl = safeCallbackUrl(raw);
  if (callbackUrl === "/") return LOGIN_PATH;
  return `${LOGIN_PATH}?${new URLSearchParams({ callbackUrl })}`;
}
