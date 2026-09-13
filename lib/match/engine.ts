import "server-only";

import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { getPgError, PgCode } from "@/lib/db/errors";
import { friendships } from "@/lib/db/schema/friends";
import {
  matchInvites,
  matchRounds,
  matchSeats,
  matches,
} from "@/lib/db/schema/matches";
import { stills } from "@/lib/db/schema/stills";
import { users } from "@/lib/db/schema/users";
import { isOnline } from "@/lib/friends/rules";
import { MATCH_LOBBY_TTL_MS, MATCH_MAX_ROUNDS, MATCH_MIN_STILLS, MATCH_START_HEALTH, type MatchHostRole, type MatchSeatRole } from "@/lib/game/match";
import { MatchRoomNotifyError, matchRoomConfigured, notifyMatchRoom } from "@/lib/match/notify";
import type { MatchCompletePayload } from "@/lib/match/protocol";
import { stillLive } from "@/lib/match/rules";
import type {
  MatchHomeDto,
  MatchLobbyDto,
  MatchLobbyInviteDto,
  MatchLobbySeatDto,
} from "@/lib/match/types";

export class MatchEngineError extends Error {
  constructor(
    readonly code:
      | "unavailable"
      | "not-found"
      | "not-host"
      | "not-friends"
      | "cannot-invite-self"
      | "player-busy"
      | "already-in-match"
      | "lobby-expired"
      | "not-lobby"
      | "not-pending"
      | "seats-full"
      | "players-not-connected"
      | "catalog-too-small"
      | "not-seated"
      | "match-over",
  ) {
    super(code);
    this.name = "MatchEngineError";
  }
}

const LIVE = ["lobby", "live"] as const;

async function areFriends(userId: string, otherId: string) {
  const row = await db.query.friendships.findFirst({
    where: and(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)),
        and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId)),
      ),
      eq(friendships.status, "accepted"),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

async function hasLivePlayerSeat(userId: string, exceptMatchId?: string) {
  const rows = await db
    .select({ matchId: matchSeats.matchId })
    .from(matchSeats)
    .innerJoin(matches, eq(matchSeats.matchId, matches.id))
    .where(
      and(
        eq(matchSeats.userId, userId),
        inArray(matchSeats.role, ["player_a", "player_b"]),
        stillLive(),
        exceptMatchId ? ne(matches.id, exceptMatchId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function hasLiveHost(userId: string, exceptMatchId?: string) {
  const row = await db.query.matches.findFirst({
    where: and(
      eq(matches.hostUserId, userId),
      stillLive(),
      exceptMatchId ? ne(matches.id, exceptMatchId) : undefined,
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

async function notifyMatchRoomRetry(
  matchId: string,
  body: unknown,
): Promise<Response> {
  try {
    return await notifyMatchRoom(matchId, body);
  } catch (first) {
    try {
      return await notifyMatchRoom(matchId, body);
    } catch {
      throw first;
    }
  }
}

async function hasLiveMatch(userId: string, exceptMatchId?: string) {
  return (
    (await hasLiveHost(userId, exceptMatchId)) ||
    (await hasLivePlayerSeat(userId, exceptMatchId))
  );
}

async function usernameOf(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { username: true },
  });
  return row?.username ?? null;
}

async function loadMatch(matchId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      seats: true,
      invites: true,
    },
  });
  if (!match) throw new MatchEngineError("not-found");
  return match;
}

async function expireIfNeeded(matchId: string) {
  const match = await loadMatch(matchId);
  if (
    match.status === "lobby" &&
    match.lobbyExpiresAt.getTime() <= Date.now()
  ) {
    await cancelMatchInternal(matchId);
    throw new MatchEngineError("lobby-expired");
  }
  return match;
}

async function endLobby(matchId: string) {
  const row = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.status, "lobby")),
    columns: { id: true, mode: true },
  });
  if (!row) return;
  if (row.mode === "private") {
    await db.delete(matches).where(eq(matches.id, matchId));
    return;
  }
  await db
    .update(matches)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(and(eq(matches.id, matchId), eq(matches.status, "lobby")));
}

async function cancelMatchInternal(matchId: string) {
  try {
    await notifyMatchRoom(matchId, { type: "cancel" });
  } catch {
    // Room may already be gone.
  }
  await endLobby(matchId);
}

function hostRoleFromSeats(
  seats: { role: MatchSeatRole; userId: string | null }[],
  hostUserId: string,
): MatchHostRole {
  const observer = seats.find((seat) => seat.role === "host_observer");
  if (observer?.userId === hostUserId) return "observer";
  return "player";
}

function youRole(
  userId: string,
  match: {
    hostUserId: string;
    seats: { role: MatchSeatRole; userId: string | null }[];
    invites: { userId: string; status: string }[];
  },
): MatchLobbyDto["youRole"] {
  const seated = match.seats.find((seat) => seat.userId === userId);
  if (seated) return seated.role;
  if (match.invites.some((invite) => invite.userId === userId && invite.status === "pending")) {
    return "invitee";
  }
  return "none";
}

async function toLobbyDto(userId: string, matchId: string): Promise<MatchLobbyDto> {
  const match = await expireIfNeeded(matchId);
  const seatUserIds = match.seats
    .map((seat) => seat.userId)
    .filter((id): id is string => typeof id === "string");
  const inviteUserIds = match.invites.map((invite) => invite.userId);
  const ids = [...new Set([...seatUserIds, ...inviteUserIds, match.hostUserId])];
  const people =
    ids.length === 0
      ? []
      : await db.query.users.findMany({
          where: inArray(users.id, ids),
          columns: { id: true, username: true },
        });
  const nameById = new Map(people.map((row) => [row.id, row.username]));

  const friendRows = await db.query.friendships.findMany({
    where: and(
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      eq(friendships.status, "accepted"),
    ),
  });
  const friendIds = friendRows.map((row) =>
    row.requesterId === userId ? row.addresseeId : row.requesterId,
  );
  const friendUsers =
    friendIds.length === 0
      ? []
      : await db.query.users.findMany({
          where: inArray(users.id, friendIds),
          columns: { id: true, username: true, lastSeenAt: true },
        });
  const busyFriendIds = new Set<string>();
  if (friendIds.length > 0) {
    const seatedBusy = await db
      .select({ userId: matchSeats.userId })
      .from(matchSeats)
      .innerJoin(matches, eq(matchSeats.matchId, matches.id))
      .where(
        and(
          inArray(matchSeats.userId, friendIds),
          stillLive(),
          ne(matches.id, matchId),
        ),
      );
    const hostedBusy = await db
      .select({ userId: matches.hostUserId })
      .from(matches)
      .where(
        and(
          inArray(matches.hostUserId, friendIds),
          stillLive(),
          ne(matches.id, matchId),
        ),
      );
    for (const row of seatedBusy) {
      if (row.userId) busyFriendIds.add(row.userId);
    }
    for (const row of hostedBusy) busyFriendIds.add(row.userId);
  }

  const seats: MatchLobbySeatDto[] = match.seats.map((seat) => ({
    role: seat.role,
    userId: seat.userId,
    username: seat.userId ? (nameById.get(seat.userId) ?? null) : null,
  }));
  const invites: MatchLobbyInviteDto[] = match.invites.map((invite) => ({
    userId: invite.userId,
    username: nameById.get(invite.userId) ?? "unknown",
    status: invite.status,
  }));

  const playerA = match.seats.find((seat) => seat.role === "player_a");
  const playerB = match.seats.find((seat) => seat.role === "player_b");

  return {
    matchId: match.id,
    status: match.status,
    hostUserId: match.hostUserId,
    hostRole: hostRoleFromSeats(match.seats, match.hostUserId),
    youRole: youRole(userId, match),
    lobbyExpiresAt: match.lobbyExpiresAt.toISOString(),
    seats,
    invites,
    friends: friendUsers
      .map((row) => ({
        id: row.id,
        username: row.username,
        busy: busyFriendIds.has(row.id),
        online: isOnline(row.lastSeenAt),
      }))
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.username.localeCompare(b.username);
      }),
    canStart: false,
    winnerUserId: match.winnerUserId,
    healthA: playerA?.health ?? null,
    healthB: playerB?.health ?? null,
  };
}

export async function createMatch(userId: string, hostRole: MatchHostRole) {
  if (!matchRoomConfigured()) throw new MatchEngineError("unavailable");
  if (await hasLiveMatch(userId)) {
    throw new MatchEngineError("already-in-match");
  }

  const hostName = await usernameOf(userId);
  const lobbyExpiresAt = new Date(Date.now() + MATCH_LOBBY_TTL_MS);

  const created = await db.transaction(async (tx) => {
    const [match] = await tx
      .insert(matches)
      .values({
        hostUserId: userId,
        lobbyExpiresAt,
      })
      .returning();
    if (!match) throw new Error("Insert did not return a match.");

    if (hostRole === "observer") {
      await tx.insert(matchSeats).values([
        {
          matchId: match.id,
          role: "host_observer",
          userId,
          health: null,
        },
        {
          matchId: match.id,
          role: "player_a",
          userId: null,
          health: MATCH_START_HEALTH,
        },
        {
          matchId: match.id,
          role: "player_b",
          userId: null,
          health: MATCH_START_HEALTH,
        },
      ]);
    } else {
      await tx.insert(matchSeats).values([
        {
          matchId: match.id,
          role: "player_a",
          userId,
          health: MATCH_START_HEALTH,
        },
        {
          matchId: match.id,
          role: "player_b",
          userId: null,
          health: MATCH_START_HEALTH,
        },
      ]);
    }
    return match;
  });

  try {
    await notifyMatchRoom(created.id, {
      type: "initLobby",
      expiresAt: lobbyExpiresAt.getTime(),
      hostUserId: userId,
      hostUsername: hostName,
      playerA:
        hostRole === "player"
          ? { userId, username: hostName, health: MATCH_START_HEALTH }
          : null,
      playerB: null,
      hostObserver:
        hostRole === "observer"
          ? { userId, username: hostName }
          : null,
    });
  } catch (error) {
    await db.delete(matches).where(eq(matches.id, created.id));
    try {
      await notifyMatchRoom(created.id, { type: "cancel" });
    } catch {
      // Room may never have been created.
    }
    if (error instanceof MatchRoomNotifyError) {
      throw new MatchEngineError("unavailable");
    }
    throw error;
  }

  return toLobbyDto(userId, created.id);
}

export async function invitePlayer(
  userId: string,
  matchId: string,
  friendId: string,
) {
  if (userId === friendId) throw new MatchEngineError("cannot-invite-self");
  const match = await expireIfNeeded(matchId);
  if (match.status !== "lobby") throw new MatchEngineError("not-lobby");
  if (match.hostUserId !== userId) throw new MatchEngineError("not-host");
  if (!(await areFriends(userId, friendId))) {
    throw new MatchEngineError("not-friends");
  }
  if (await hasLiveMatch(friendId)) {
    throw new MatchEngineError("player-busy");
  }

  const pendingOrAccepted = await db.query.matchInvites.findMany({
    where: and(
      eq(matchInvites.matchId, matchId),
      eq(matchInvites.kind, "player"),
      inArray(matchInvites.status, ["pending", "accepted"]),
    ),
    columns: { userId: true },
  });
  const hostIsPlayer = hostRoleFromSeats(match.seats, match.hostUserId) === "player";
  const maxInvites = hostIsPlayer ? 1 : 2;
  const already = pendingOrAccepted.some((invite) => invite.userId === friendId);
  if (already) return toLobbyDto(userId, matchId);
  if (pendingOrAccepted.length >= maxInvites) {
    throw new MatchEngineError("seats-full");
  }

  const emptyPlayer = await db.query.matchSeats.findFirst({
    where: and(
      eq(matchSeats.matchId, matchId),
      inArray(matchSeats.role, ["player_a", "player_b"]),
      isNull(matchSeats.userId),
    ),
    columns: { id: true },
  });
  if (!emptyPlayer) throw new MatchEngineError("seats-full");

  try {
    await db
      .insert(matchInvites)
      .values({
        matchId,
        userId: friendId,
        kind: "player",
        status: "pending",
      })
      .onConflictDoUpdate({
        target: [matchInvites.matchId, matchInvites.userId],
        set: { status: "pending" },
        setWhere: eq(matchInvites.status, "declined"),
      });
  } catch {
    throw new MatchEngineError("unavailable");
  }

  return toLobbyDto(userId, matchId);
}

export async function acceptInvite(userId: string, matchId: string) {
  const match = await expireIfNeeded(matchId);
  if (match.status !== "lobby") throw new MatchEngineError("not-lobby");
  const invite = match.invites.find(
    (row) => row.userId === userId && row.status === "pending",
  );
  if (!invite) throw new MatchEngineError("not-pending");
  if (await hasLiveMatch(userId, matchId)) {
    throw new MatchEngineError("player-busy");
  }

  if (
    !match.seats.some(
      (seat) =>
        (seat.role === "player_a" || seat.role === "player_b") && !seat.userId,
    )
  ) {
    throw new MatchEngineError("seats-full");
  }

  const name = await usernameOf(userId);
  let claimedRole: MatchSeatRole | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: matches.status })
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update");
    if (!row || row.status !== "lobby") {
      throw new MatchEngineError("not-lobby");
    }
    await tx
      .update(matchInvites)
      .set({ status: "accepted" })
      .where(eq(matchInvites.id, invite.id));
    const [empty] = await tx
      .select({ id: matchSeats.id, role: matchSeats.role })
      .from(matchSeats)
      .where(
        and(
          eq(matchSeats.matchId, matchId),
          inArray(matchSeats.role, ["player_a", "player_b"]),
          isNull(matchSeats.userId),
        ),
      )
      .for("update")
      .limit(1);
    if (!empty) throw new MatchEngineError("seats-full");
    const [taken] = await tx
      .update(matchSeats)
      .set({ userId })
      .where(and(eq(matchSeats.id, empty.id), isNull(matchSeats.userId)))
      .returning({ id: matchSeats.id, role: matchSeats.role });
    if (!taken) throw new MatchEngineError("seats-full");
    claimedRole = taken.role;
  });
  if (!claimedRole) throw new MatchEngineError("seats-full");

  try {
    await notifyMatchRoomRetry(matchId, {
      type: "seatFilled",
      role: claimedRole,
      userId,
      username: name,
    });
  } catch {
    // Seat is in Postgres; onConnect can still claim an empty DO seat.
  }

  return toLobbyDto(userId, matchId);
}

export async function declineInvite(userId: string, matchId: string) {
  const match = await expireIfNeeded(matchId);
  const invite = match.invites.find(
    (row) => row.userId === userId && row.status === "pending",
  );
  if (!invite) throw new MatchEngineError("not-pending");
  await db
    .update(matchInvites)
    .set({ status: "declined" })
    .where(eq(matchInvites.id, invite.id));
  return getMatchHome(userId);
}

export async function hostRemovePlayer(
  userId: string,
  matchId: string,
  targetUserId: string,
) {
  if (userId === targetUserId) throw new MatchEngineError("not-host");
  const match = await expireIfNeeded(matchId);
  if (match.status !== "lobby") throw new MatchEngineError("not-lobby");
  if (match.hostUserId !== userId) throw new MatchEngineError("not-host");
  if (match.hostUserId === targetUserId) throw new MatchEngineError("not-host");

  const seat = match.seats.find(
    (row) =>
      row.userId === targetUserId &&
      (row.role === "player_a" || row.role === "player_b"),
  );
  const invite = match.invites.find(
    (row) =>
      row.userId === targetUserId &&
      (row.status === "pending" || row.status === "accepted"),
  );
  if (!seat && !invite) throw new MatchEngineError("not-pending");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: matches.status })
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update");
    if (!row || row.status !== "lobby") {
      throw new MatchEngineError("not-lobby");
    }
    if (seat) {
      try {
        await notifyMatchRoom(matchId, { type: "seatCleared", role: seat.role });
      } catch {
        throw new MatchEngineError("unavailable");
      }
      await tx
        .update(matchSeats)
        .set({ userId: null })
        .where(eq(matchSeats.id, seat.id));
    }
    await tx
      .update(matchInvites)
      .set({ status: "declined" })
      .where(
        and(
          eq(matchInvites.matchId, matchId),
          eq(matchInvites.userId, targetUserId),
        ),
      );
  });
  return toLobbyDto(userId, matchId);
}

export async function leaveMatch(userId: string, matchId: string) {
  const match = await expireIfNeeded(matchId);
  if (match.status !== "lobby") throw new MatchEngineError("not-lobby");
  if (match.hostUserId === userId) {
    await cancelMatchInternal(matchId);
    return getMatchHome(userId);
  }
  const seat = match.seats.find((row) => row.userId === userId);
  if (!seat) throw new MatchEngineError("not-seated");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: matches.status })
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update");
    if (!row || row.status !== "lobby") {
      throw new MatchEngineError("not-lobby");
    }
    try {
      await notifyMatchRoom(matchId, { type: "seatCleared", role: seat.role });
    } catch {
      throw new MatchEngineError("unavailable");
    }
    await tx
      .update(matchSeats)
      .set({ userId: null })
      .where(eq(matchSeats.id, seat.id));
    await tx
      .update(matchInvites)
      .set({ status: "declined" })
      .where(
        and(eq(matchInvites.matchId, matchId), eq(matchInvites.userId, userId)),
      );
  });
  return getMatchHome(userId);
}

export async function getMatchLobby(userId: string, matchId: string) {
  const match = await expireIfNeeded(matchId);
  const role = youRole(userId, match);
  if (role === "none") throw new MatchEngineError("not-seated");
  return toLobbyDto(userId, matchId);
}

export async function getMatchHome(userId: string): Promise<MatchHomeDto> {
  const hosted = await db.query.matches.findFirst({
    where: and(eq(matches.hostUserId, userId), inArray(matches.status, [...LIVE])),
    columns: { id: true, status: true, lobbyExpiresAt: true },
  });
  const seated = await db
    .select({
      matchId: matches.id,
      status: matches.status,
      lobbyExpiresAt: matches.lobbyExpiresAt,
    })
    .from(matchSeats)
    .innerJoin(matches, eq(matchSeats.matchId, matches.id))
    .where(
      and(
        eq(matchSeats.userId, userId),
        inArray(matches.status, [...LIVE]),
      ),
    )
    .limit(1);

  let rejoin: MatchHomeDto["rejoin"] = null;
  const hostedId = hosted?.id;
  const seatedId = seated[0]?.matchId;
  const liveId = hostedId ?? seatedId;
  const liveRow = hosted ?? seated[0];
  if (liveRow && liveId) {
    if (
      liveRow.status === "lobby" &&
      liveRow.lobbyExpiresAt.getTime() <= Date.now()
    ) {
      await cancelMatchInternal(liveId);
    } else {
      rejoin = { matchId: liveId, status: liveRow.status as "lobby" | "live" };
    }
  }

  const incoming = await db
    .select({
      matchId: matchInvites.matchId,
      hostUsername: users.username,
    })
    .from(matchInvites)
    .innerJoin(matches, eq(matchInvites.matchId, matches.id))
    .innerJoin(users, eq(matches.hostUserId, users.id))
    .where(
      and(
        eq(matchInvites.userId, userId),
        eq(matchInvites.status, "pending"),
        eq(matches.status, "lobby"),
        gt(matches.lobbyExpiresAt, new Date()),
      ),
    );

  return { rejoin, incomingInvites: rejoin ? [] : incoming };
}

export async function getMatchSeat(
  userId: string,
  matchId: string,
): Promise<{ role: MatchSeatRole; status: string } | null> {
  let match;
  try {
    match = await expireIfNeeded(matchId);
  } catch (error) {
    if (
      error instanceof MatchEngineError &&
      (error.code === "not-found" || error.code === "lobby-expired")
    ) {
      return null;
    }
    throw error;
  }
  if (match.status === "cancelled" || match.status === "completed") {
    return null;
  }
  const seat = match.seats.find((row) => row.userId === userId);
  if (!seat) return null;
  return { role: seat.role, status: match.status };
}

export async function startMatch(userId: string, matchId: string) {
  if (!matchRoomConfigured()) throw new MatchEngineError("unavailable");
  const match = await expireIfNeeded(matchId);
  if (match.status !== "lobby") throw new MatchEngineError("not-lobby");
  if (match.hostUserId !== userId) throw new MatchEngineError("not-host");
  const playerA = match.seats.find((seat) => seat.role === "player_a");
  const playerB = match.seats.find((seat) => seat.role === "player_b");
  if (!playerA?.userId || !playerB?.userId) {
    throw new MatchEngineError("players-not-connected");
  }

  let connected: { playerA: boolean; playerB: boolean };
  try {
    const response = await notifyMatchRoom(matchId, {
      type: "connectedPlayers",
    });
    const parsed = z
      .object({ playerA: z.boolean(), playerB: z.boolean() })
      .safeParse(await response.json());
    if (!parsed.success) throw new MatchEngineError("unavailable");
    connected = parsed.data;
  } catch (error) {
    if (error instanceof MatchEngineError) throw error;
    throw new MatchEngineError("unavailable");
  }
  if (!connected.playerA || !connected.playerB) {
    throw new MatchEngineError("players-not-connected");
  }

  const catalog = await db
    .select({
      id: stills.id,
      imageUrl: stills.imageUrl,
      x: stills.x,
      z: stills.z,
    })
    .from(stills)
    .orderBy(sql`random()`)
    .limit(MATCH_MAX_ROUNDS);
  if (catalog.length < MATCH_MIN_STILLS) {
    throw new MatchEngineError("catalog-too-small");
  }

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ status: matches.status })
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");
      if (!row || row.status !== "lobby") {
        throw new MatchEngineError("not-lobby");
      }
      const seats = await tx
        .select({
          role: matchSeats.role,
          userId: matchSeats.userId,
        })
        .from(matchSeats)
        .where(eq(matchSeats.matchId, matchId))
        .for("update");
      const lockedA = seats.find((seat) => seat.role === "player_a");
      const lockedB = seats.find((seat) => seat.role === "player_b");
      if (!lockedA?.userId || !lockedB?.userId) {
        throw new MatchEngineError("players-not-connected");
      }

      try {
        await notifyMatchRoom(matchId, { type: "startMatch", stills: catalog });
      } catch (error) {
        if (error instanceof MatchRoomNotifyError && error.status === 409) {
          // Room already started; still mark live below.
        } else if (error instanceof MatchRoomNotifyError && error.status === 410) {
          throw new MatchEngineError("lobby-expired");
        } else if (error instanceof MatchRoomNotifyError && error.status === 412) {
          throw new MatchEngineError("players-not-connected");
        } else {
          throw new MatchEngineError("unavailable");
        }
      }

      await tx
        .update(matches)
        .set({ status: "live", startedAt: new Date() })
        .where(and(eq(matches.id, matchId), eq(matches.status, "lobby")));
    });
  } catch (error) {
    if (error instanceof MatchEngineError && error.code === "lobby-expired") {
      await cancelMatchInternal(matchId);
    }
    throw error;
  }

  return toLobbyDto(userId, matchId);
}

export async function completeMatch(
  matchId: string,
  payload: MatchCompletePayload,
) {
  const existing = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    columns: { id: true, status: true, mode: true },
  });
  if (!existing) return;
  if (existing.mode === "private") {
    await db.delete(matches).where(eq(matches.id, matchId));
    return;
  }
  if (existing.status === "completed") return;
  if (existing.status === "cancelled") return;

  try {
    await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        status: "completed",
        endedAt: new Date(),
        winnerUserId: payload.winnerUserId,
      })
      .where(eq(matches.id, matchId));
    if (payload.healthA !== undefined) {
      await tx
        .update(matchSeats)
        .set({ health: payload.healthA })
        .where(and(eq(matchSeats.matchId, matchId), eq(matchSeats.role, "player_a")));
      await tx
        .update(matchSeats)
        .set({ health: payload.healthB })
        .where(and(eq(matchSeats.matchId, matchId), eq(matchSeats.role, "player_b")));
    }
    if (payload.rounds.length > 0) {
      await tx.insert(matchRounds).values(
        payload.rounds.map((round) => ({
          matchId,
          roundIndex: round.roundIndex,
          stillId: round.stillId,
          multiplier: round.multiplier,
          guessAx: round.guessA?.x ?? null,
          guessAz: round.guessA?.z ?? null,
          guessBx: round.guessB?.x ?? null,
          guessBz: round.guessB?.z ?? null,
          scoreA: round.scoreA,
          scoreB: round.scoreB,
          damage: round.damage,
          loserId: round.loserId,
          resolvedAt: new Date(round.resolvedAt),
        })),
      );
    }
    });
  } catch (error) {
    if (getPgError(error).code === PgCode.UniqueViolation) return;
    throw error;
  }
}

export async function expireMatch(matchId: string) {
  await endLobby(matchId);
}
