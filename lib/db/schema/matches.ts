import { relations } from "drizzle-orm";
import {
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

export const MatchesUnique = {
  id: "matches_id",
} as const;

export const MatchInvitesUnique = {
  matchUser: "match_invites_match_id_user_id_unique",
} as const;

export const MatchSeatsUnique = {
  matchRole: "match_seats_match_id_role_unique",
  matchUser: "match_seats_match_id_user_id_unique",
} as const;

export const MatchRoundsUnique = {
  matchIndex: "match_rounds_match_id_round_index_unique",
} as const;

export const matchModeEnum = pgEnum("match_mode", ["private", "ranked"]);
export const matchStatusEnum = pgEnum("match_status", [
  "lobby",
  "live",
  "cancelled",
  "completed",
]);
export const matchInviteKindEnum = pgEnum("match_invite_kind", [
  "player",
  "spectator",
]);
export const matchInviteStatusEnum = pgEnum("match_invite_status", [
  "pending",
  "accepted",
  "declined",
]);
export const matchSeatRoleEnum = pgEnum("match_seat_role", [
  "player_a",
  "player_b",
  "host_observer",
]);

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: matchModeEnum("mode").notNull().default("private"),
  status: matchStatusEnum("status").notNull().default("lobby"),
  hostUserId: uuid("host_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lobbyExpiresAt: timestamp("lobby_expires_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  winnerUserId: uuid("winner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const matchInvites = pgTable(
  "match_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: matchInviteKindEnum("kind").notNull().default("player"),
    status: matchInviteStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique(MatchInvitesUnique.matchUser).on(t.matchId, t.userId)],
);

export const matchSeats = pgTable(
  "match_seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    role: matchSeatRoleEnum("role").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    health: integer("health"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique(MatchSeatsUnique.matchRole).on(t.matchId, t.role),
    unique(MatchSeatsUnique.matchUser).on(t.matchId, t.userId),
  ],
);

export const matchRounds = pgTable(
  "match_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    roundIndex: integer("round_index").notNull(),
    stillId: uuid("still_id")
      .notNull()
      .references(() => stills.id, { onDelete: "restrict" }),
    multiplier: doublePrecision("multiplier").notNull(),
    guessAx: doublePrecision("guess_ax"),
    guessAz: doublePrecision("guess_az"),
    guessBx: doublePrecision("guess_bx"),
    guessBz: doublePrecision("guess_bz"),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    damage: integer("damage").notNull(),
    loserId: uuid("loser_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique(MatchRoundsUnique.matchIndex).on(t.matchId, t.roundIndex)],
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  host: one(users, {
    fields: [matches.hostUserId],
    references: [users.id],
    relationName: "matchHost",
  }),
  winner: one(users, {
    fields: [matches.winnerUserId],
    references: [users.id],
    relationName: "matchWinner",
  }),
  invites: many(matchInvites),
  seats: many(matchSeats),
  rounds: many(matchRounds),
}));

export const matchInvitesRelations = relations(matchInvites, ({ one }) => ({
  match: one(matches, {
    fields: [matchInvites.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [matchInvites.userId],
    references: [users.id],
  }),
}));

export const matchSeatsRelations = relations(matchSeats, ({ one }) => ({
  match: one(matches, {
    fields: [matchSeats.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [matchSeats.userId],
    references: [users.id],
  }),
}));

export const matchRoundsRelations = relations(matchRounds, ({ one }) => ({
  match: one(matches, {
    fields: [matchRounds.matchId],
    references: [matches.id],
  }),
  still: one(stills, {
    fields: [matchRounds.stillId],
    references: [stills.id],
  }),
}));
