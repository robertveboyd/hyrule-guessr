import { parseArgs, type ParseArgsConfig } from "node:util";
import { type ZodType, type z } from "zod";

export function parseWithZod<S extends ZodType>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(issue.message);
    }
    process.exit(1);
  }
  return parsed.data;
}

export function parseFlags<S extends ZodType>(
  options: NonNullable<ParseArgsConfig["options"]>,
  schema: S,
): z.infer<S> {
  return parseWithZod(
    schema,
    parseArgs({
      args: process.argv.slice(2).filter((arg) => arg !== "--"),
      options,
      strict: true,
      allowPositionals: false,
    }).values,
  );
}
