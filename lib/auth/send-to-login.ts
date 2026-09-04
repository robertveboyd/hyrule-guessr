import { loginPathWithCallback } from "@/lib/auth/login-url";
import { clearSessionId } from "@/lib/auth/session-storage";

export function sendToLogin() {
  clearSessionId();
  window.location.replace(
    loginPathWithCallback(`${location.pathname}${location.search}`),
  );
}
