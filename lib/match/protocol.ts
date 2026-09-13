import { z } from "zod";

import type { GamePoint } from "@/lib/game/crs";
import type { MatchSeatRole } from "@/lib/game/match";

export const matchStillSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  x: z.number().finite(),
  z: z.number().finite(),
});

export type MatchStill = z.infer<typeof matchStillSchema>;

export const matchSeatPublicSchema = z.object({
  userId: z.string().nullable(),
  username: z.string().nullable(),
  connected: z.boolean(),
  health: z.number().nullable(),
  multiplier: z.number().nullable(),
  locked: z.boolean(),
});

export const matchRevealSchema = z.object({
  guessA: z.object({ x: z.number(), z: z.number() }).nullable(),
  guessB: z.object({ x: z.number(), z: z.number() }).nullable(),
  truth: z.object({ x: z.number(), z: z.number() }),
  scoreA: z.number(),
  scoreB: z.number(),
  damage: z.number(),
  loser: z.enum(["a", "b"]).nullable(),
  healthA: z.number(),
  healthB: z.number(),
});

export const matchSnapshotSchema = z.object({
  type: z.literal("matchSnapshot"),
  matchId: z.string(),
  phase: z.enum([
    "lobby",
    "playing",
    "grace",
    "scoring",
    "betweenRounds",
    "over",
    "cancelled",
  ]),
  hostUserId: z.string(),
  lobbyExpiresAt: z.number().nullable(),
  roundIndex: z.number(),
  roundCount: z.number(),
  multiplier: z.number(),
  imageUrl: z.string().nullable(),
  endsAt: z.number().nullable(),
  playerA: matchSeatPublicSchema,
  playerB: matchSeatPublicSchema,
  hostObserver: matchSeatPublicSchema,
  youRole: z.enum(["player_a", "player_b", "host_observer"]),
  youLocked: z.boolean(),
  youCanLock: z.boolean(),
  opponentLocked: z.boolean(),
  reveal: matchRevealSchema.nullable(),
  winnerUserId: z.string().nullable(),
});

export type MatchSnapshot = z.infer<typeof matchSnapshotSchema>;

export const matchInboundSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lockIn"),
    x: z.number().finite(),
    z: z.number().finite(),
  }),
  z.object({
    type: z.literal("mapMoved"),
    x: z.number().finite(),
    z: z.number().finite(),
    zoom: z.number().finite().optional(),
  }),
]);

export type MatchInbound = z.infer<typeof matchInboundSchema>;

export function parseMatchInbound(data: string): MatchInbound | null {
  try {
    const parsed = matchInboundSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseMatchSnapshot(data: string): MatchSnapshot | null {
  try {
    const parsed = matchSnapshotSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type MatchGuess = GamePoint | null;

export type MatchCompleteRound = {
  roundIndex: number;
  stillId: string;
  multiplier: number;
  guessA: GamePoint | null;
  guessB: GamePoint | null;
  scoreA: number;
  scoreB: number;
  damage: number;
  loserId: string | null;
  resolvedAt: number;
};

export type MatchCompletePayload = {
  winnerUserId: string | null;
  healthA: number;
  healthB: number;
  rounds: MatchCompleteRound[];
};

export type MatchSeatRolePublic = MatchSeatRole;
