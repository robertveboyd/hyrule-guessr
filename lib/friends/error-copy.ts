import type { FriendsErrorCode } from "./types";

export const FRIENDS_UNEXPECTED_MESSAGE =
  "Something went wrong. Try again.";

export function friendsErrorMessage(code: FriendsErrorCode): string {
  switch (code) {
    case "cannot-friend-self":
      return "You cannot friend yourself.";
    case "user-not-found":
      return "No user with that name.";
    case "not-pending":
      return "That friend request is no longer pending.";
    case "not-friends":
      return "You are not friends with that user.";
    case "forbidden":
      return "This tab is no longer the active session.";
  }
}
