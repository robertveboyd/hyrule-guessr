import { headers } from "next/headers";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, number[]>();

function prune(times: number[], now: number) {
  return times.filter((time) => now - time < WINDOW_MS);
}

function key(email: string, ip: string) {
  return `${email}\0${ip}`;
}

export async function getLoginClientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "local";
}

export function isLoginRateLimited(email: string, ip: string) {
  const now = Date.now();
  const times = prune(attempts.get(key(email, ip)) ?? [], now);
  attempts.set(key(email, ip), times);
  return times.length >= MAX_FAILURES;
}

export function recordLoginFailure(email: string, ip: string) {
  const now = Date.now();
  const id = key(email, ip);
  const times = prune(attempts.get(id) ?? [], now);
  times.push(now);
  attempts.set(id, times);
}

export function clearLoginFailures(email: string, ip: string) {
  attempts.delete(key(email, ip));
}
