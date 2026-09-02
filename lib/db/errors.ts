export const PgCode = {
  ForeignKeyViolation: "23503",
  UniqueViolation: "23505",
} as const;

export function getPgError(
  error: unknown,
): { code?: string; constraint?: string } {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const e = current as {
      code?: string;
      constraint?: string;
      constraint_name?: string;
      cause?: unknown;
    };
    if (e.code) {
      return {
        code: e.code,
        constraint: e.constraint ?? e.constraint_name,
      };
    }
    current = e.cause;
  }
  return {};
}
