import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { stills } from "./stills";
import { users } from "./users";

export const SpRunsUnique = {
  userId: "sp_runs_user_id_unique",
} as const;

export const SpRoundsUnique = {
  runIndex: "sp_rounds_run_id_round_index_unique",
} as const;

export const SpRunsCheck = {
  currentRoundIndex: "sp_runs_current_round_index_check",
} as const;

export const SpRoundsCheck = {
  roundIndex: "sp_rounds_round_index_check",
} as const;

export const spRunModeEnum = pgEnum("sp_run_mode", ["casual", "timed"]);

export const spRuns = pgTable(
  "sp_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(SpRunsUnique.userId),
    mode: spRunModeEnum("mode").notNull(),
    currentRoundIndex: integer("current_round_index").notNull().default(1),
    inSummary: boolean("in_summary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      SpRunsCheck.currentRoundIndex,
      sql`${t.currentRoundIndex} >= 1 AND ${t.currentRoundIndex} <= 5`,
    ),
  ],
);

export const spRounds = pgTable(
  "sp_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => spRuns.id, { onDelete: "cascade" }),
    roundIndex: integer("round_index").notNull(),
    stillId: uuid("still_id")
      .notNull()
      .references(() => stills.id, { onDelete: "restrict" }),
    guessX: doublePrecision("guess_x"),
    guessZ: doublePrecision("guess_z"),
    score: integer("score"),
    distanceMeters: integer("distance_meters"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique(SpRoundsUnique.runIndex).on(t.runId, t.roundIndex),
    check(
      SpRoundsCheck.roundIndex,
      sql`${t.roundIndex} >= 1 AND ${t.roundIndex} <= 5`,
    ),
  ],
);

export const stillsRelations = relations(stills, ({ many }) => ({
  spRounds: many(spRounds),
}));

export const spRunsRelations = relations(spRuns, ({ one, many }) => ({
  user: one(users, { fields: [spRuns.userId], references: [users.id] }),
  rounds: many(spRounds),
}));

export const spRoundsRelations = relations(spRounds, ({ one }) => ({
  run: one(spRuns, { fields: [spRounds.runId], references: [spRuns.id] }),
  still: one(stills, { fields: [spRounds.stillId], references: [stills.id] }),
}));
