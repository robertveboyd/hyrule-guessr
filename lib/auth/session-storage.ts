export const SESSION_STORAGE_KEY = "hyrule-guessr.sessionId";

export function readSessionId() {
  return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

export function writeSessionId(sessionId: string) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

export function clearSessionId() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
