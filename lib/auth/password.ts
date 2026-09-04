import "server-only";
import { hash, verify } from "argon2";
import { argon2Options } from "./argon2-options";

/**
 * Same Argon2id costs as `argon2Options` (`m=19456,t=2,p=1`). Used only so a
 * missing user still pays `verify` time. Not a real account hash.
 * Regenerate if those costs change: `hash("hyrule-guessr.timing", argon2Options)`.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$M3KWO/r+RRF/R7SHlnS6Og$BVaSx8ds9WNfh0yWaDpq9isdjBmkD3RTIHxU7QdmZ6A";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, argon2Options);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  try {
    const ok = await verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
    return typeof passwordHash === "string" && ok;
  } catch {
    return false;
  }
}
