import { argon2id } from "argon2";

export const argon2Options = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;