import { readSessionId } from "@/lib/auth/session-storage";

export async function fetchExclusiveSessionActive(): Promise<boolean> {
  const response = await fetch("/api/exclusive-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSessionId: readSessionId() }),
  });
  if (!response.ok) {
    throw new Error("Exclusive session check failed");
  }

  const data: unknown = await response.json();
  return (
    typeof data === "object" &&
    data !== null &&
    "active" in data &&
    data.active === true
  );
}
