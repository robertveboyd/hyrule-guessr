import { doublePrecision, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const StillsUnique = {
  contentHash: "stills_content_hash_unique",
} as const;

export const stills = pgTable("stills", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  contentHash: text("content_hash").unique(StillsUnique.contentHash),
  x: doublePrecision("x").notNull(),
  z: doublePrecision("z").notNull(),
});
