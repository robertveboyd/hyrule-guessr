import "server-only";

import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getPgError, PgCode } from "@/lib/db/errors";
import { friendships, FriendshipsUnique } from "@/lib/db/schema/friends";
import { users } from "@/lib/db/schema/users";

import {
  decideFriendRequest,
  escapeIlike,
  isOnline,
  relationFor,
  toPublicUser,
} from "./rules";
import {
  SEARCH_MAX_HITS,
  SEARCH_MIN_CHARS,
  type FriendRequestRow,
  type FriendsListDto,
  type SearchHitDto,
} from "./types";

export class FriendsEngineError extends Error {
  constructor(
    readonly code: "cannot-friend-self" | "user-not-found" | "not-pending" | "not-friends",
  ) {
    super(code);
    this.name = "FriendsEngineError";
  }
}

function pairWhere(userId: string, otherId: string) {
  return or(
    and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherId)),
    and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, userId)),
  );
}

async function loadPair(
  userId: string,
  otherId: string,
): Promise<FriendRequestRow | null> {
  const row = await db.query.friendships.findFirst({
    where: pairWhere(userId, otherId),
    columns: {
      requesterId: true,
      addresseeId: true,
      status: true,
    },
  });
  return row ?? null;
}

async function requireUser(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, avatarId: true },
  });
  if (!row) throw new FriendsEngineError("user-not-found");
  return row;
}

export async function listFriends(userId: string): Promise<FriendsListDto> {
  const rows = await db.query.friendships.findMany({
    where: or(
      eq(friendships.requesterId, userId),
      eq(friendships.addresseeId, userId),
    ),
  });

  const otherIds = rows.map((row) =>
    row.requesterId === userId ? row.addresseeId : row.requesterId,
  );
  const others =
    otherIds.length === 0
      ? []
      : await db.query.users.findMany({
          where: inArray(users.id, otherIds),
          columns: {
            id: true,
            username: true,
            avatarId: true,
            lastSeenAt: true,
          },
        });
  const byId = new Map(others.map((row) => [row.id, row]));
  const now = new Date();

  const friends: FriendsListDto["friends"] = [];
  const incoming: FriendsListDto["incoming"] = [];
  const outgoing: FriendsListDto["outgoing"] = [];

  for (const row of rows) {
    const otherId =
      row.requesterId === userId ? row.addresseeId : row.requesterId;
    const other = byId.get(otherId);
    if (!other) continue;
    const publicUser = toPublicUser(other);
    if (row.status === "accepted") {
      friends.push({
        ...publicUser,
        online: isOnline(other.lastSeenAt, now),
      });
    } else if (row.requesterId === userId) {
      outgoing.push(publicUser);
    } else {
      incoming.push(publicUser);
    }
  }

  friends.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
  incoming.sort((a, b) => a.username.localeCompare(b.username));
  outgoing.sort((a, b) => a.username.localeCompare(b.username));

  return { friends, incoming, outgoing };
}

export async function searchUsers(
  userId: string,
  rawQuery: string,
): Promise<SearchHitDto[]> {
  const query = rawQuery.trim();
  if (query.length < SEARCH_MIN_CHARS) return [];

  const pattern = `%${escapeIlike(query)}%`;
  const hits = await db
    .select({
      id: users.id,
      username: users.username,
      avatarId: users.avatarId,
    })
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        sql`${users.username} ilike ${pattern} escape ${"\\"}`,
      ),
    )
    .limit(SEARCH_MAX_HITS);

  if (hits.length === 0) return [];

  const hitIds = hits.map((hit) => hit.id);
  const pairs = await db.query.friendships.findMany({
    where: or(
      and(
        eq(friendships.requesterId, userId),
        inArray(friendships.addresseeId, hitIds),
      ),
      and(
        eq(friendships.addresseeId, userId),
        inArray(friendships.requesterId, hitIds),
      ),
    ),
    columns: {
      requesterId: true,
      addresseeId: true,
      status: true,
    },
  });

  const pairByOther = new Map<string, FriendRequestRow>();
  for (const pair of pairs) {
    const otherId =
      pair.requesterId === userId ? pair.addresseeId : pair.requesterId;
    pairByOther.set(otherId, pair);
  }

  return hits.map((hit) => ({
    ...toPublicUser(hit),
    relation: relationFor(userId, hit.id, pairByOther.get(hit.id) ?? null),
  }));
}

export async function requestFriend(
  userId: string,
  otherId: string,
): Promise<FriendsListDto> {
  const decision = decideFriendRequest(
    userId,
    otherId,
    await loadPair(userId, otherId),
  );
  if (decision === "self") throw new FriendsEngineError("cannot-friend-self");
  await requireUser(otherId);

  if (decision === "accept-opposite") {
    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(pairWhere(userId, otherId));
    return listFriends(userId);
  }

  if (decision === "noop") return listFriends(userId);

  try {
    await db.insert(friendships).values({
      requesterId: userId,
      addresseeId: otherId,
      status: "pending",
    });
  } catch (error) {
    const pg = getPgError(error);
    if (pg.code === PgCode.UniqueViolation) {
      const again = decideFriendRequest(
        userId,
        otherId,
        await loadPair(userId, otherId),
      );
      if (again === "accept-opposite") {
        await db
          .update(friendships)
          .set({ status: "accepted" })
          .where(pairWhere(userId, otherId));
      }
      return listFriends(userId);
    }
    if (pg.constraint === FriendshipsUnique.pair) {
      return listFriends(userId);
    }
    throw error;
  }

  return listFriends(userId);
}

export async function acceptFriend(
  userId: string,
  otherId: string,
): Promise<FriendsListDto> {
  const existing = await loadPair(userId, otherId);
  if (
    !existing ||
    existing.status !== "pending" ||
    existing.addresseeId !== userId
  ) {
    throw new FriendsEngineError("not-pending");
  }
  await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(pairWhere(userId, otherId));
  return listFriends(userId);
}

export async function rejectFriend(
  userId: string,
  otherId: string,
): Promise<FriendsListDto> {
  const existing = await loadPair(userId, otherId);
  if (
    !existing ||
    existing.status !== "pending" ||
    existing.addresseeId !== userId
  ) {
    throw new FriendsEngineError("not-pending");
  }
  await db.delete(friendships).where(pairWhere(userId, otherId));
  return listFriends(userId);
}

export async function unfriend(
  userId: string,
  otherId: string,
): Promise<FriendsListDto> {
  const existing = await loadPair(userId, otherId);
  if (!existing || existing.status !== "accepted") {
    throw new FriendsEngineError("not-friends");
  }
  await db.delete(friendships).where(pairWhere(userId, otherId));
  return listFriends(userId);
}

export async function heartbeatPresence(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, userId));
}

export async function clearPresence(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastSeenAt: null })
    .where(eq(users.id, userId));
}
