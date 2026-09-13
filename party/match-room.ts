import { Server } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { z } from "zod";

import { clampToMainField } from "../lib/game/crs";
import { applyRoundDamage, matchOutcome } from "../lib/game/damage";
import {
  MATCH_BETWEEN_ROUNDS_MS,
  MATCH_GRACE_MS,
  MATCH_LOCK_IN_GRACE_MS,
  MATCH_MAX_ROUNDS,
  MATCH_RECONNECT_MS,
  MATCH_ROUND_MS,
  MATCH_START_HEALTH,
  MATCH_START_MULTIPLIER,
  seatRoleToSocketRole,
  type MatchSeatRole,
} from "../lib/game/match";
import { scoreGuess } from "../lib/game/score";
import {
  MATCH_ROOM_CLOSE_REPLACED,
  MATCH_ROOM_CLOSE_UNAUTHORIZED,
} from "../lib/match/party";
import {
  matchStillSchema,
  parseMatchInbound,
  type MatchCompletePayload,
  type MatchStill,
} from "../lib/match/protocol";
import { secretsEqual } from "./join-token";
import { verifyMatchJoinToken } from "./match-join-token";

const STATE_KEY = "matchState";

type SeatState = {
  userId: string | null;
  username: string | null;
  health: number | null;
  multiplier: number | null;
  guess: { x: number; z: number } | null;
  locked: boolean;
  disconnectUntil: number | null;
};

type RevealState = {
  guessA: { x: number; z: number } | null;
  guessB: { x: number; z: number } | null;
  truth: { x: number; z: number };
  scoreA: number;
  scoreB: number;
  damage: number;
  loser: "a" | "b" | null;
  healthA: number;
  healthB: number;
};

type CompletedRound = {
  roundIndex: number;
  stillId: string;
  multiplier: number;
  guessA: { x: number; z: number } | null;
  guessB: { x: number; z: number } | null;
  scoreA: number;
  scoreB: number;
  damage: number;
  loserId: string | null;
  resolvedAt: number;
};

type MatchState = {
  phase:
    | "lobby"
    | "playing"
    | "grace"
    | "scoring"
    | "betweenRounds"
    | "over"
    | "cancelled";
  expiresAt: number | null;
  hostUserId: string;
  hostUsername: string | null;
  playerA: SeatState;
  playerB: SeatState;
  hostObserver: SeatState;
  stills: MatchStill[];
  roundIndex: number;
  originalEndsAt: number | null;
  roundEndsAt: number | null;
  reveal: RevealState | null;
  winnerUserId: string | null;
  completedRounds: CompletedRound[];
  persistFailed: boolean;
};

type ConnState = { userId: string; role: MatchSeatRole };

const initLobbySchema = z.object({
  type: z.literal("initLobby"),
  expiresAt: z.number(),
  hostUserId: z.string(),
  hostUsername: z.string().nullable(),
  playerA: z
    .object({
      userId: z.string(),
      username: z.string().nullable(),
      health: z.number(),
    })
    .nullable(),
  playerB: z
    .object({
      userId: z.string(),
      username: z.string().nullable(),
      health: z.number(),
    })
    .nullable(),
  hostObserver: z
    .object({
      userId: z.string(),
      username: z.string().nullable(),
    })
    .nullable(),
});

const seatFilledSchema = z.object({
  type: z.literal("seatFilled"),
  role: z.enum(["player_a", "player_b", "host_observer"]),
  userId: z.string(),
  username: z.string().nullable(),
});

const seatClearedSchema = z.object({
  type: z.literal("seatCleared"),
  role: z.enum(["player_a", "player_b", "host_observer"]),
});

const startMatchSchema = z.object({
  type: z.literal("startMatch"),
  stills: z.array(matchStillSchema).min(5).max(MATCH_MAX_ROUNDS),
});

const inboundHttpSchema = z.discriminatedUnion("type", [
  initLobbySchema,
  seatFilledSchema,
  seatClearedSchema,
  startMatchSchema,
  z.object({ type: z.literal("connectedPlayers") }),
  z.object({ type: z.literal("cancel") }),
]);

function emptySeat(health: number | null): SeatState {
  return {
    userId: null,
    username: null,
    health,
    multiplier: health == null ? null : MATCH_START_MULTIPLIER,
    guess: null,
    locked: false,
    disconnectUntil: null,
  };
}

function fromPublic(
  seat: { userId: string; username: string | null; health?: number } | null,
  health: number | null,
): SeatState {
  if (!seat) return emptySeat(health);
  return {
    userId: seat.userId,
    username: seat.username,
    health: seat.health ?? health,
    multiplier: health == null ? null : MATCH_START_MULTIPLIER,
    guess: null,
    locked: false,
    disconnectUntil: null,
  };
}

function seatMultiplier(seat: SeatState) {
  return seat.multiplier ?? MATCH_START_MULTIPLIER;
}

function bearerSecret(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

export class MatchRoom extends Server {
  static options = { hibernate: true };

  async onConnect(connection: Connection, ctx: ConnectionContext) {
    const secret = this.env.MATCH_ROOM_SECRET;
    const token = new URL(ctx.request.url).searchParams.get("token");
    if (!secret || !token) {
      connection.close(MATCH_ROOM_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }
    const claims = await verifyMatchJoinToken(secret, token);
    if (!claims || claims.matchId !== this.name) {
      connection.close(MATCH_ROOM_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }

    const state = await this.loadState();
    if (!state || state.phase === "cancelled") {
      connection.close(MATCH_ROOM_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }

    const seat = this.seatByRole(state, claims.role);
    if (seat.userId && seat.userId !== claims.userId) {
      connection.close(MATCH_ROOM_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }
    if (!seat.userId) {
      if (state.phase !== "lobby") {
        connection.close(MATCH_ROOM_CLOSE_UNAUTHORIZED, "unauthorized");
        return;
      }
      seat.userId = claims.userId;
    }

    for (const existing of this.getConnections<ConnState>()) {
      if (existing.id === connection.id) continue;
      if (
        existing.state?.userId === claims.userId ||
        existing.state?.role === claims.role
      ) {
        existing.close(MATCH_ROOM_CLOSE_REPLACED, "replaced");
      }
    }

    connection.setState({ userId: claims.userId, role: claims.role });
    if (
      (state.phase === "playing" || state.phase === "grace") &&
      !this.roundDeadlinePassed(state)
    ) {
      this.clearDisconnect(state, claims.role);
    }
    await this.saveState(state);
    if (state.phase === "playing" || state.phase === "grace") {
      await this.armRoundAlarm(state);
    }
    connection.send(this.snapshotFor(state, claims.role));
    await this.broadcastSnapshots(state);
  }

  getConnectionTags(connection: Connection) {
    const role = (connection.state as ConnState | null)?.role;
    return role ? [seatRoleToSocketRole(role)] : [];
  }

  async onMessage(connection: Connection, message: WSMessage) {
    if (typeof message !== "string") return;
    const inbound = parseMatchInbound(message);
    if (!inbound) return;
    if (inbound.type === "mapMoved") return;

    const conn = connection.state as ConnState | null;
    if (!conn) return;
    if (conn.role !== "player_a" && conn.role !== "player_b") return;

    const state = await this.loadState();
    if (!state) return;
    if (state.phase !== "playing" && state.phase !== "grace") return;

    const seat = conn.role === "player_a" ? state.playerA : state.playerB;
    if (seat.userId !== conn.userId) return;
    if (seat.locked) return;
    if (!this.lockInOpen(state, seat)) return;

    const point = clampToMainField({ x: inbound.x, z: inbound.z });
    seat.guess = point;
    seat.locked = true;
    this.clearDisconnect(state, conn.role);

    const both = state.playerA.locked && state.playerB.locked;
    if (both) {
      await this.resolveRound(state);
      return;
    }

    if (state.phase === "playing" && state.originalEndsAt) {
      const graceEnds = Math.min(Date.now() + MATCH_GRACE_MS, state.originalEndsAt);
      state.phase = "grace";
      state.roundEndsAt = graceEnds;
    }

    await this.saveState(state);
    await this.armRoundAlarm(state);
    await this.broadcastSnapshots(state);
  }

  async onClose(connection: Connection, code: number) {
    const conn = connection.state as ConnState | null;
    const state = await this.loadState();
    if (!state || !conn) {
      if (state) await this.broadcastSnapshots(state);
      return;
    }
    if (
      code !== MATCH_ROOM_CLOSE_REPLACED &&
      (state.phase === "playing" || state.phase === "grace") &&
      (conn.role === "player_a" || conn.role === "player_b")
    ) {
      const seat = conn.role === "player_a" ? state.playerA : state.playerB;
      if (!seat.locked && !this.roleConnected(conn.role, connection.id)) {
        seat.disconnectUntil = Date.now() + MATCH_RECONNECT_MS;
        await this.saveState(state);
        await this.armRoundAlarm(state);
      }
    }
    await this.broadcastSnapshots(state);
  }

  async onAlarm() {
    const state = await this.loadState();
    if (!state) return;

    if (state.persistFailed && state.phase === "over") {
      await this.persistComplete(state);
      return;
    }

    if (state.phase === "cancelled") {
      await this.expireOnNext();
      return;
    }

    if (state.phase === "lobby") {
      state.phase = "cancelled";
      await this.saveState(state);
      await this.broadcastSnapshots(state);
      await this.expireOnNext();
      return;
    }

    if (state.phase === "playing" || state.phase === "grace") {
      this.applyDisconnectTimeouts(state);
      if (state.playerA.locked && state.playerB.locked) {
        await this.resolveRound(state);
        return;
      }
      const pendingReconnect = this.pendingReconnect(state);
      const timeUp = this.roundDeadlinePassed(state);
      if (!timeUp) {
        await this.saveState(state);
        await this.armRoundAlarm(state);
        await this.broadcastSnapshots(state);
        return;
      }
      if (pendingReconnect) {
        await this.saveState(state);
        await this.armRoundAlarm(state);
        await this.broadcastSnapshots(state);
        return;
      }
      for (const seat of [state.playerA, state.playerB]) {
        if (!seat.locked) {
          seat.locked = true;
          seat.guess = null;
        }
      }
      await this.resolveRound(state);
      return;
    }

    if (state.phase === "betweenRounds") {
      const last = state.completedRounds.at(-1);
      const outcome = last
        ? matchOutcome({
            healthA: state.playerA.health ?? 0,
            healthB: state.playerB.health ?? 0,
            playerAId: state.playerA.userId ?? "",
            playerBId: state.playerB.userId ?? "",
            lastScheduledRound:
              state.roundIndex >= state.stills.length,
            ko:
              (state.playerA.health ?? 0) === 0 ||
              (state.playerB.health ?? 0) === 0,
          })
        : { over: false, winnerUserId: null };
      if (outcome.over) {
        state.winnerUserId = outcome.winnerUserId;
        await this.finishMatch(state);
        return;
      }
      await this.startRound(state, state.roundIndex + 1);
    }
  }

  async onRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const secret = this.env.MATCH_ROOM_SECRET;
    const provided = bearerSecret(request.headers.get("Authorization"));
    if (!secret || !provided || !secretsEqual(provided, secret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    const parsed = inboundHttpSchema.safeParse(json);
    if (!parsed.success) {
      return new Response("Bad Request", { status: 400 });
    }
    const body = parsed.data;

    if (body.type === "connectedPlayers") {
      return Response.json({
        playerA: this.roleConnected("player_a"),
        playerB: this.roleConnected("player_b"),
      });
    }

    if (body.type === "cancel") {
      const state = await this.loadState();
      if (state) {
        state.phase = "cancelled";
        await this.saveState(state);
        await this.broadcastSnapshots(state);
      }
      return new Response(null, { status: 204 });
    }

    if (body.type === "initLobby") {
      const existing = await this.loadState();
      if (
        existing &&
        existing.phase !== "lobby" &&
        existing.phase !== "cancelled"
      ) {
        return new Response("Conflict", { status: 409 });
      }
      const state: MatchState = {
        phase: "lobby",
        expiresAt: body.expiresAt,
        hostUserId: body.hostUserId,
        hostUsername: body.hostUsername,
        playerA: fromPublic(body.playerA, MATCH_START_HEALTH),
        playerB: fromPublic(body.playerB, MATCH_START_HEALTH),
        hostObserver: fromPublic(
          body.hostObserver
            ? { ...body.hostObserver, health: undefined }
            : null,
          null,
        ),
        stills: [],
        roundIndex: 0,
        originalEndsAt: null,
        roundEndsAt: null,
        reveal: null,
        winnerUserId: null,
        completedRounds: [],
        persistFailed: false,
      };
      await this.saveState(state);
      await this.ctx.storage.setAlarm(body.expiresAt);
      return new Response(null, { status: 204 });
    }

    const state = await this.loadState();
    if (!state) return new Response("Not Found", { status: 404 });

    if (body.type === "seatFilled") {
      if (state.phase !== "lobby") {
        return new Response("Conflict", { status: 409 });
      }
      const seat = this.seatByRole(state, body.role);
      if (seat.userId && seat.userId !== body.userId) {
        return new Response("Conflict", { status: 409 });
      }
      seat.userId = body.userId;
      seat.username = body.username;
      await this.saveState(state);
      await this.broadcastSnapshots(state);
      return new Response(null, { status: 204 });
    }

    if (body.type === "seatCleared") {
      if (state.phase !== "lobby") {
        return new Response("Conflict", { status: 409 });
      }
      const seat = this.seatByRole(state, body.role);
      seat.userId = null;
      seat.username = null;
      seat.guess = null;
      seat.locked = false;
      await this.saveState(state);
      for (const connection of this.getConnections<ConnState>()) {
        if (connection.state?.role === body.role) {
          connection.close(MATCH_ROOM_CLOSE_REPLACED, "replaced");
        }
      }
      await this.broadcastSnapshots(state);
      return new Response(null, { status: 204 });
    }

    if (state.phase === "cancelled") {
      return new Response("Gone", { status: 410 });
    }
    if (state.phase !== "lobby") {
      return new Response("Conflict", { status: 409 });
    }
    if (!this.roleConnected("player_a") || !this.roleConnected("player_b")) {
      return new Response("Precondition Failed", { status: 412 });
    }
    state.stills = body.stills;
    state.playerA.multiplier = MATCH_START_MULTIPLIER;
    state.playerB.multiplier = MATCH_START_MULTIPLIER;
    await this.startRound(state, 1);
    return new Response(null, { status: 204 });
  }

  private seatByRole(state: MatchState, role: MatchSeatRole): SeatState {
    if (role === "player_a") return state.playerA;
    if (role === "player_b") return state.playerB;
    return state.hostObserver;
  }

  private roleConnected(role: MatchSeatRole, exceptId?: string) {
    for (const connection of this.getConnections<ConnState>()) {
      if (exceptId && connection.id === exceptId) continue;
      if (connection.state?.role === role) return true;
    }
    return false;
  }

  private lockInOpen(state: MatchState, seat: SeatState) {
    const deadline = this.roundDeadline(state);
    const until = Math.max(deadline ?? 0, seat.disconnectUntil ?? 0);
    if (until === 0) return true;
    return Date.now() <= until;
  }

  private clearDisconnect(state: MatchState, role: MatchSeatRole) {
    const seat = this.seatByRole(state, role);
    seat.disconnectUntil = null;
  }

  private applyDisconnectTimeouts(state: MatchState) {
    const now = Date.now();
    const seats: { seat: SeatState; role: MatchSeatRole }[] = [
      { seat: state.playerA, role: "player_a" },
      { seat: state.playerB, role: "player_b" },
    ];
    for (const { seat, role } of seats) {
      if (
        !seat.locked &&
        seat.disconnectUntil &&
        seat.disconnectUntil <= now &&
        !this.roleConnected(role)
      ) {
        seat.locked = true;
        seat.guess = null;
        seat.disconnectUntil = null;
      }
    }
  }

  private seatAwaitingReconnect(
    state: MatchState,
    seat: SeatState,
    role: MatchSeatRole,
  ) {
    const now = Date.now();
    if (seat.locked) return false;
    if (seat.disconnectUntil == null || seat.disconnectUntil <= now) {
      return false;
    }
    if (!this.roleConnected(role)) return true;
    return this.roundDeadlinePassed(state);
  }

  private pendingReconnect(state: MatchState) {
    return (
      this.seatAwaitingReconnect(state, state.playerA, "player_a") ||
      this.seatAwaitingReconnect(state, state.playerB, "player_b")
    );
  }

  private roundDeadline(state: MatchState): number | null {
    if (state.roundEndsAt == null) return null;
    return state.roundEndsAt + MATCH_LOCK_IN_GRACE_MS;
  }

  private roundDeadlinePassed(state: MatchState) {
    const deadline = this.roundDeadline(state);
    return deadline != null && Date.now() >= deadline;
  }

  private async armRoundAlarm(state: MatchState) {
    const now = Date.now();
    const times: number[] = [];
    const deadline = this.roundDeadline(state);
    const waiting = this.pendingReconnect(state);
    if (deadline != null) {
      if (deadline > now) times.push(deadline);
      else if (!waiting) times.push(now);
    }
    for (const seat of [state.playerA, state.playerB]) {
      if (
        !seat.locked &&
        seat.disconnectUntil != null &&
        seat.disconnectUntil > now
      ) {
        times.push(seat.disconnectUntil);
      }
    }
    const next = times.sort((a, b) => a - b)[0];
    if (next == null) return;
    await this.ctx.storage.setAlarm(Math.max(next, now));
  }

  private async startRound(state: MatchState, roundIndex: number) {
    const still = state.stills[roundIndex - 1];
    if (!still) {
      await this.finishMatch(state);
      return;
    }
    state.phase = "playing";
    state.roundIndex = roundIndex;
    state.reveal = null;
    state.playerA.guess = null;
    state.playerA.locked = false;
    state.playerA.disconnectUntil = null;
    state.playerB.guess = null;
    state.playerB.locked = false;
    state.playerB.disconnectUntil = null;
    const endsAt = Date.now() + MATCH_ROUND_MS;
    state.originalEndsAt = endsAt;
    state.roundEndsAt = endsAt;
    await this.saveState(state);
    await this.armRoundAlarm(state);
    await this.broadcastSnapshots(state);
  }

  private async resolveRound(state: MatchState) {
    if (state.phase !== "playing" && state.phase !== "grace") return;
    const still = state.stills[state.roundIndex - 1];
    if (!still) return;
    const scoreA = state.playerA.guess
      ? scoreGuess(state.playerA.guess, still).score
      : 0;
    const scoreB = state.playerB.guess
      ? scoreGuess(state.playerB.guess, still).score
      : 0;
    const applied = applyRoundDamage({
      healthA: state.playerA.health ?? MATCH_START_HEALTH,
      healthB: state.playerB.health ?? MATCH_START_HEALTH,
      scoreA,
      scoreB,
      multiplierA: seatMultiplier(state.playerA),
      multiplierB: seatMultiplier(state.playerB),
    });
    state.playerA.health = applied.healthA;
    state.playerB.health = applied.healthB;
    state.playerA.multiplier = applied.multiplierA;
    state.playerB.multiplier = applied.multiplierB;
    const loserId =
      applied.loser === "a"
        ? state.playerA.userId
        : applied.loser === "b"
          ? state.playerB.userId
          : null;
    const resolvedAt = Date.now();
    state.completedRounds.push({
      roundIndex: state.roundIndex,
      stillId: still.id,
      multiplier: applied.damageMultiplier,
      guessA: state.playerA.guess,
      guessB: state.playerB.guess,
      scoreA,
      scoreB,
      damage: applied.damage,
      loserId,
      resolvedAt,
    });
    state.reveal = {
      guessA: state.playerA.guess,
      guessB: state.playerB.guess,
      truth: { x: still.x, z: still.z },
      scoreA,
      scoreB,
      damage: applied.damage,
      loser: applied.loser,
      healthA: applied.healthA,
      healthB: applied.healthB,
    };
    state.phase = "betweenRounds";
    state.roundEndsAt = Date.now() + MATCH_BETWEEN_ROUNDS_MS;
    await this.saveState(state);
    await this.ctx.storage.setAlarm(state.roundEndsAt);
    await this.broadcastSnapshots(state);
  }

  private async finishMatch(state: MatchState) {
    state.phase = "over";
    await this.saveState(state);
    await this.broadcastSnapshots(state);
    await this.persistComplete(state);
  }

  private async persistComplete(state: MatchState) {
    const payload: MatchCompletePayload = {
      winnerUserId: state.winnerUserId,
      healthA: state.playerA.health ?? 0,
      healthB: state.playerB.health ?? 0,
      rounds: state.completedRounds,
    };
    const url = `${this.env.APP_URL}/api/internal/matches/${this.name}/complete`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.env.MATCH_ROOM_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(String(response.status));
      state.persistFailed = false;
      await this.saveState(state);
    } catch {
      state.persistFailed = true;
      await this.saveState(state);
      await this.ctx.storage.setAlarm(Date.now() + 5000);
    }
  }

  private async expireOnNext() {
    try {
      const response = await fetch(
        `${this.env.APP_URL}/api/internal/matches/${this.name}/expire`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.env.MATCH_ROOM_SECRET}`,
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      await this.ctx.storage.setAlarm(Date.now() + 5000);
    }
  }

  private snapshotEndsAt(state: MatchState, viewSeat: SeatState | null) {
    if (
      viewSeat &&
      !viewSeat.locked &&
      this.lockInOpen(state, viewSeat)
    ) {
      let endsAt = state.roundEndsAt;
      if (
        viewSeat.disconnectUntil != null &&
        (endsAt == null || viewSeat.disconnectUntil > endsAt)
      ) {
        endsAt = viewSeat.disconnectUntil;
      }
      return endsAt;
    }
    let endsAt = state.roundEndsAt;
    if (state.phase === "playing" || state.phase === "grace") {
      for (const seat of [state.playerA, state.playerB]) {
        if (
          !seat.locked &&
          seat.disconnectUntil != null &&
          (endsAt == null || seat.disconnectUntil > endsAt)
        ) {
          endsAt = seat.disconnectUntil;
        }
      }
    }
    return endsAt;
  }

  private snapshotFor(state: MatchState, role: MatchSeatRole) {
    const still = state.stills[state.roundIndex - 1];
    const viewSeat =
      role === "player_a"
        ? state.playerA
        : role === "player_b"
          ? state.playerB
          : null;
    const youLocked = viewSeat ? viewSeat.locked : false;
    const youCanLock =
      (state.phase === "playing" || state.phase === "grace") &&
      viewSeat != null &&
      !viewSeat.locked &&
      this.lockInOpen(state, viewSeat);
    const opponentLocked =
      role === "player_a"
        ? state.playerB.locked
        : role === "player_b"
          ? state.playerA.locked
          : state.playerA.locked || state.playerB.locked;
    const endsAt = this.snapshotEndsAt(state, viewSeat);
    return JSON.stringify({
      type: "matchSnapshot",
      matchId: this.name,
      phase: state.phase,
      hostUserId: state.hostUserId,
      lobbyExpiresAt: state.expiresAt,
      roundIndex: state.roundIndex,
      roundCount: state.stills.length,
      multiplier:
        role === "player_a"
          ? seatMultiplier(state.playerA)
          : role === "player_b"
            ? seatMultiplier(state.playerB)
            : MATCH_START_MULTIPLIER,
      imageUrl:
        state.phase === "lobby" || state.phase === "cancelled"
          ? null
          : (still?.imageUrl ?? null),
      endsAt,
      playerA: {
        userId: state.playerA.userId,
        username: state.playerA.username,
        connected: this.roleConnected("player_a"),
        health: state.playerA.health,
        multiplier: seatMultiplier(state.playerA),
        locked: state.playerA.locked,
      },
      playerB: {
        userId: state.playerB.userId,
        username: state.playerB.username,
        connected: this.roleConnected("player_b"),
        health: state.playerB.health,
        multiplier: seatMultiplier(state.playerB),
        locked: state.playerB.locked,
      },
      hostObserver: {
        userId: state.hostObserver.userId,
        username: state.hostObserver.username,
        connected: this.roleConnected("host_observer"),
        health: null,
        multiplier: null,
        locked: false,
      },
      youRole: role,
      youLocked,
      youCanLock,
      opponentLocked,
      reveal: state.reveal,
      winnerUserId: state.winnerUserId,
    });
  }

  private async broadcastSnapshots(state: MatchState) {
    for (const connection of this.getConnections<ConnState>()) {
      const role = connection.state?.role;
      const userId = connection.state?.userId;
      if (!role || !userId) continue;
      connection.send(this.snapshotFor(state, role));
    }
  }

  private async loadState(): Promise<MatchState | null> {
    return (await this.ctx.storage.get<MatchState>(STATE_KEY)) ?? null;
  }

  private async saveState(state: MatchState) {
    await this.ctx.storage.put(STATE_KEY, state);
  }
}
