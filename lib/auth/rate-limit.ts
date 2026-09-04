import { headers } from "next/headers";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 4096;

const attempts = new Map<string, number[]>();

function prune(times: number[], now: number) {
  return times.filter((time) => now - time < WINDOW_MS);
}

function key(email: string, ip: string) {
  return `${email}\0${ip}`;
}

function setAttempts(id: string, times: number[]) {
  if (times.length === 0) {
    attempts.delete(id);
    return;
  }

  if (attempts.has(id)) attempts.delete(id);
  attempts.set(id, times);

  while (attempts.size > MAX_KEYS) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined || oldest === id) break;
    attempts.delete(oldest);
  }
}

export async function getLoginClientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "local";
}

export function isLoginRateLimited(email: string, ip: string) {
  const now = Date.now();
  const id = key(email, ip);
  const times = prune(attempts.get(id) ?? [], now);
  setAttempts(id, times);
  return times.length >= MAX_FAILURES;
}

export function recordLoginFailure(email: string, ip: string) {
  const now = Date.now();
  const id = key(email, ip);
  const times = prune(attempts.get(id) ?? [], now);
  times.push(now);
  setAttempts(id, times);
}

export function clearLoginFailures(email: string, ip: string) {
  attempts.delete(key(email, ip));
}
