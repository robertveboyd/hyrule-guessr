import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const UsersUnique = {
  email: "users_email_unique",
  username: "users_username_lower_idx",
} as const;

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(UsersUnique.email),
    password: text("password").notNull(),
    username: text("username").notNull(),
    avatarId: text("avatar_id").notNull().default("default"),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex(UsersUnique.username).on(sql`lower(${t.username})`),
  ],
);
