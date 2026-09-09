export type FriendsErrorCode =
  | "forbidden"
  | "cannot-friend-self"
  | "user-not-found"
  | "not-pending"
  | "not-friends";

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_HITS = 20;
export const PRESENCE_TTL_MS = 20_000;
export const PRESENCE_HEARTBEAT_MS = 10_000;
export const FRIENDS_POLL_MS = 10_000;

export type FriendshipStatus = "pending" | "accepted";

export type FriendRelation = "none" | "outgoing" | "incoming" | "friends";

export type PublicUserDto = {
  id: string;
  username: string;
  avatarId: string;
};

export type SearchHitDto = PublicUserDto & {
  relation: FriendRelation;
};

export type FriendRowDto = PublicUserDto & {
  online: boolean;
};

export type FriendsListDto = {
  friends: FriendRowDto[];
  incoming: PublicUserDto[];
  outgoing: PublicUserDto[];
};

export type FriendRequestRow = {
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
};

export type FriendRequestDecision =
  | "self"
  | "insert"
  | "accept-opposite"
  | "noop";
