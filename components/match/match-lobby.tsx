"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { LobbyShell, StatusLine, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { Button } from "@/components/ui/button";
import { RoundTimer } from "@/components/practice/round-timer";
import { lobbyHostHint, openSeatInviteHint } from "@/lib/match/copy";
import { matchErrorMessage } from "@/lib/match/error-copy";
import type { MatchSnapshot } from "@/lib/match/protocol";
import type { MatchLobbyDto } from "@/lib/match/types";
import { cn } from "@/lib/utils";

type SeatView = {
  seat: MatchLobbyDto["seats"][number];
  invite: MatchLobbyDto["invites"][number] | null;
  connected: boolean;
};

export function MatchLobby({
  lobby,
  snapshot,
  userId,
  pending,
  unavailable,
  message,
  onInvite,
  onAccept,
  onDecline,
  onStart,
  onLeave,
  onRemove,
  onRetry,
}: {
  lobby: MatchLobbyDto;
  snapshot: MatchSnapshot | null;
  userId: string;
  pending: boolean;
  unavailable: boolean;
  message: string | null;
  onInvite: (friendId: string) => void;
  onAccept: () => void;
  onDecline: () => void;
  onStart: () => void;
  onLeave: () => void;
  onRemove: (targetUserId: string) => void;
  onRetry?: () => void;
}) {
  const isHost = lobby.hostUserId === userId;
  const invitee = lobby.youRole === "invitee";
  const blockingInviteIds = new Set(
    lobby.invites
      .filter(
        (invite) => invite.status === "pending" || invite.status === "accepted",
      )
      .map((invite) => invite.userId),
  );
  const seatedIds = new Set(
    lobby.seats.map((seat) => seat.userId).filter(Boolean),
  );
  const inviteable = lobby.friends.filter(
    (friend) => !blockingInviteIds.has(friend.id) && !seatedIds.has(friend.id),
  );
  const playerSeats = lobby.seats.filter((seat) => seat.role !== "host_observer");
  const pendingInvites = lobby.invites.filter(
    (invite) => invite.status === "pending",
  );
  let pendingCursor = 0;
  const cards: SeatView[] = playerSeats.map((seat) => {
    const invite = seat.userId
      ? null
      : (pendingInvites[pendingCursor++] ?? null);
    const connected =
      snapshot
        ? seat.role === "player_a"
          ? snapshot.playerA.connected
          : snapshot.playerB.connected
        : false;
    return { seat, invite, connected };
  });
  const emptyCard = cards.find((card) => !card.seat.userId);
  const joiningCard = cards.find(
    (card) => card.seat.userId && !card.connected,
  );
  const hostName =
    lobby.seats.find((seat) => seat.userId === lobby.hostUserId)?.username ??
    "the host";
  const onlineInviteable = inviteable.filter(
    (friend) => friend.online && !friend.busy,
  );
  const canInviteOnline = cards.some(
    (card) => hostCanInvite(isHost, invitee, card),
  ) && onlineInviteable.length > 0;

  return (
    <LobbyShell title="Versus">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4">
        {lobby.hostRole === "observer" ? (
          <p className="h-5 text-center text-sm text-muted-foreground">
            {isHost
              ? "You're hosting — you won't guess."
              : "The host is watching this match."}
          </p>
        ) : null}

        <div className="relative z-10 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3">
          {cards[0] ? (
            <SeatCard
              card={cards[0]}
              you={
                cards[0].seat.userId === userId ||
                Boolean(invitee && cards[0].invite?.userId === userId)
              }
              tone="p1"
              pending={pending}
              inviteable={inviteable}
              showInvite={hostCanInvite(isHost, invitee, cards[0])}
              remove={seatRemove(isHost, invitee, lobby.hostUserId, cards[0])}
              onInvite={onInvite}
              onRemove={onRemove}
            />
          ) : null}
          <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 px-1">
            <span className="font-heading text-sm text-amber">VS</span>
            <RoundTimer
              endsAt={lobby.lobbyExpiresAt}
              dangerBelowMs={60_000}
              className="text-xs"
            />
          </div>
          {cards[1] ? (
            <SeatCard
              card={cards[1]}
              you={
                cards[1].seat.userId === userId ||
                Boolean(invitee && cards[1].invite?.userId === userId)
              }
              tone="p2"
              pending={pending}
              inviteable={inviteable}
              showInvite={hostCanInvite(isHost, invitee, cards[1])}
              remove={seatRemove(isHost, invitee, lobby.hostUserId, cards[1])}
              onInvite={onInvite}
              onRemove={onRemove}
            />
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2">
          <StatusLine tone={message || unavailable ? "danger" : "muted"}>
            {message
              ? message
              : unavailable
                ? matchErrorMessage("unavailable")
                : invitee
                  ? null
                  : isHost
                    ? lobbyHostHint({
                        canStart: lobby.canStart,
                        canInviteOnline,
                        waitingOnName:
                          emptyCard?.invite?.username ??
                          joiningCard?.seat.username ??
                          null,
                      })
                    : `Waiting for ${hostName} to start`}
          </StatusLine>

          {invitee ? (
            <>
              <Button
                type="button"
                className={lobbyCtaClassName}
                disabled={pending}
                onClick={onAccept}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                className={lobbyCtaClassName}
                disabled={pending}
                onClick={onDecline}
              >
                Decline
              </Button>
            </>
          ) : null}

          {!invitee && unavailable && onRetry ? (
            <Button
              type="button"
              className={lobbyCtaClassName}
              disabled={pending}
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}

          {isHost && lobby.status === "lobby" && !(unavailable && onRetry) ? (
            <Button
              type="button"
              className={lobbyCtaClassName}
              disabled={pending || !lobby.canStart || unavailable}
              onClick={onStart}
            >
              Start
            </Button>
          ) : null}

          {lobby.status === "lobby" &&
          lobby.youRole !== "invitee" &&
          lobby.youRole !== "none" ? (
            <Button
              type="button"
              variant="outline"
              className={lobbyCtaClassName}
              disabled={pending}
              onClick={onLeave}
            >
              Leave lobby
            </Button>
          ) : null}
        </div>
      </div>
    </LobbyShell>
  );
}

function hostCanInvite(isHost: boolean, invitee: boolean, card: SeatView) {
  return isHost && !invitee && !card.seat.userId && !card.invite;
}

function seatRemove(
  isHost: boolean,
  invitee: boolean,
  hostUserId: string,
  card: SeatView,
): { label: string; userId: string } | null {
  if (!isHost || invitee) return null;
  const targetId = card.seat.userId ?? card.invite?.userId ?? null;
  if (!targetId || targetId === hostUserId) return null;
  return {
    label: card.seat.userId ? "Kick" : "Cancel",
    userId: targetId,
  };
}

function SeatCard({
  card,
  you,
  tone,
  pending,
  inviteable,
  showInvite,
  remove,
  onInvite,
  onRemove,
}: {
  card: SeatView;
  you: boolean;
  tone: "p1" | "p2";
  pending: boolean;
  inviteable: MatchLobbyDto["friends"];
  showInvite: boolean;
  remove: { label: string; userId: string } | null;
  onInvite: (friendId: string) => void;
  onRemove: (targetUserId: string) => void;
}) {
  const empty = !card.seat.userId;
  const title = you ? "You" : (card.seat.username ?? card.invite?.username);
  const status = empty
    ? you || card.invite
      ? "Invited"
      : "Open"
    : card.connected
      ? "Ready"
      : "Joining…";
  const onlineFriends = inviteable.filter(
    (friend) => friend.online && !friend.busy,
  );
  const body = showInvite
    ? openSeatInviteHint({
        hasFriends: inviteable.length > 0,
        freeOnline: onlineFriends.length > 0,
        onlineBusy: inviteable.some((friend) => friend.online && friend.busy),
      })
    : status;

  return (
    <div
      className={cn(
        "relative flex h-36 min-w-0 flex-col items-center justify-center overflow-visible rounded-md border bg-hud px-4 text-center",
        you
          ? tone === "p1"
            ? "border-p1"
            : "border-p2"
          : tone === "p1"
            ? "border-p1/40"
            : "border-p2/40",
      )}
    >
      <p
        className={cn(
          "font-heading w-full truncate text-xl leading-8",
          empty && !card.invite && !you && "text-muted-foreground",
        )}
      >
        {title ?? "Open"}
      </p>
      <div className="flex h-8 w-full items-center justify-center">
        {showInvite && onlineFriends.length > 0 ? (
          <InviteMenu
            friends={onlineFriends}
            pending={pending}
            tone={tone}
            onInvite={onInvite}
          />
        ) : (
          <p
            className={cn(
              "truncate text-sm",
              card.connected && !empty
                ? tone === "p1"
                  ? "text-p1"
                  : "text-p2"
                : "text-muted-foreground",
            )}
          >
            {body}
          </p>
        )}
      </div>
      {remove ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="absolute bottom-2 text-danger"
          disabled={pending}
          aria-label={remove.label === "Cancel" ? "Cancel invite" : remove.label}
          onClick={() => onRemove(remove.userId)}
        >
          {remove.label}
        </Button>
      ) : null}
    </div>
  );
}

function InviteMenu({
  friends,
  pending,
  tone,
  onInvite,
}: {
  friends: MatchLobbyDto["friends"];
  pending: boolean;
  tone: "p1" | "p2";
  onInvite: (friendId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const only = friends.length === 1 ? friends[0] : null;
  const triggerClass = cn(
    "flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-md text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
    tone === "p1" ? "text-p1" : "text-p2",
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (only) {
    return (
      <button
        type="button"
        className={triggerClass}
        disabled={pending}
        aria-label={`Invite ${only.username}`}
        onClick={() => onInvite(only.id)}
      >
        <span className="truncate">Invite {only.username}</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative h-8 w-full">
      <button
        type="button"
        className={triggerClass}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Invite an online friend"
        onClick={() => setOpen((value) => !value)}
      >
        Invite
        <ChevronDown className={cn("size-3.5", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-md"
        >
          {friends.map((friend) => (
            <li key={friend.id}>
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm hover:bg-muted"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onInvite(friend.id);
                }}
              >
                <span className="min-w-0 truncate">{friend.username}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
