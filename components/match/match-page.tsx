"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LobbyActions, LobbyShell, StatusLine, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { MatchLobby } from "@/components/match/match-lobby";
import { MatchPlay } from "@/components/match/match-play";
import { Button } from "@/components/ui/button";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import {
  acceptInviteAction,
  declineInviteAction,
  getMatchLobbyAction,
  hostRemovePlayerAction,
  invitePlayerAction,
  leaveMatchAction,
  startMatchAction,
} from "@/lib/match/actions";
import { connectMatchRoom, type MatchRoomSend } from "@/lib/match/connect-match-room";
import { MATCH_UNEXPECTED_MESSAGE, matchErrorMessage } from "@/lib/match/error-copy";
import { applyMatchSnapshotToLobby, withLobbyPresence } from "@/lib/match/lobby-snapshot";
import type { MatchSnapshot } from "@/lib/match/protocol";
import { MATCH_HOME_POLL_MS, type MatchLobbyDto } from "@/lib/match/types";

export function MatchPage({
  matchId,
  userId,
}: {
  matchId: string;
  userId: string;
}) {
  const router = useRouter();
  const sendRef = useRef<MatchRoomSend>(() => {});
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const [lobby, setLobby] = useState<MatchLobbyDto | null>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [roomEpoch, setRoomEpoch] = useState(0);

  const [goneCopy, setGoneCopy] = useState<string | null>(null);

  const fail = useCallback((code: string) => {
    if (code === "forbidden") {
      sendToLogin();
      return;
    }
    setMessage(matchErrorMessage(code));
  }, []);

  const commitLobby = useCallback((data: MatchLobbyDto) => {
    const snap = snapshotRef.current;
    setLobby(snap ? withLobbyPresence(data, snap) : data);
  }, []);

  const markGone = useCallback((code: string) => {
    setLobby((prev) =>
      prev ? { ...prev, status: "cancelled", canStart: false } : prev,
    );
    setGoneCopy(
      code === "not-seated"
        ? "You're no longer in this lobby."
        : "This lobby was cancelled.",
    );
  }, []);

  const refreshLobby = useCallback(() => {
    void getMatchLobbyAction(readSessionId(), matchId)
      .then((result) => {
        if (result.ok) {
          commitLobby(result.data);
          return;
        }
        if (
          result.code === "not-found" ||
          result.code === "lobby-expired" ||
          result.code === "not-seated"
        ) {
          markGone(result.code);
        }
      })
      .catch(() => {});
  }, [commitLobby, markGone, matchId]);

  useEffect(() => {
    let cancelled = false;
    void getMatchLobbyAction(readSessionId(), matchId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          fail(result.code);
          return;
        }
        commitLobby(result.data);
      })
      .catch(() => {
        if (!cancelled) setMessage(MATCH_UNEXPECTED_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, [fail, matchId, commitLobby]);

  const shouldConnect =
    lobby != null &&
    lobby.youRole !== "invitee" &&
    lobby.youRole !== "none" &&
    lobby.status !== "cancelled";

  useEffect(() => {
    if (!shouldConnect) return;
    let cancelled = false;
    let close = () => {};
    void connectMatchRoom({
      matchId,
      onSnapshot: (next) => {
        if (cancelled) return;
        const previous = snapshotRef.current;
        snapshotRef.current = next;
        setSnapshot(next);
        setUnavailable(false);
        setLobby((prev) =>
          prev ? applyMatchSnapshotToLobby(prev, next) : prev,
        );
        if (
          previous &&
          ((Boolean(previous.playerA.userId) && !next.playerA.userId) ||
            (Boolean(previous.playerB.userId) && !next.playerB.userId))
        ) {
          refreshLobby();
        }
      },
      onUnavailable: () => {
        if (!cancelled) setUnavailable(true);
      },
    })
      .then((session) => {
        if (cancelled) {
          session.close();
          return;
        }
        sendRef.current = session.send;
        close = session.close;
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
      close();
      sendRef.current = () => {};
    };
  }, [shouldConnect, matchId, refreshLobby, roomEpoch]);

  useEffect(() => {
    if (lobby?.status !== "lobby") return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getMatchLobbyAction(readSessionId(), matchId)
        .then((result) => {
          if (cancelled) return;
          if (!result.ok) {
            if (
              result.code === "not-found" ||
              result.code === "lobby-expired" ||
              result.code === "not-seated"
            ) {
              markGone(result.code);
              return;
            }
            fail(result.code);
            return;
          }
          commitLobby(result.data);
        })
        .catch(() => {});
    }, MATCH_HOME_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lobby?.status, matchId, fail, commitLobby, markGone]);

  function retryRoom() {
    setRoomEpoch((value) => value + 1);
  }

  async function invite(friendId: string) {
    setPending(true);
    setMessage(null);
    try {
      const result = await invitePlayerAction(readSessionId(), matchId, friendId);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      commitLobby(result.data);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function accept() {
    setPending(true);
    setMessage(null);
    try {
      const result = await acceptInviteAction(readSessionId(), matchId);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      commitLobby(result.data);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function start() {
    setPending(true);
    setMessage(null);
    try {
      const result = await startMatchAction(readSessionId(), matchId);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      commitLobby(result.data);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function decline() {
    setPending(true);
    setMessage(null);
    try {
      const result = await declineInviteAction(readSessionId(), matchId);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      router.push("/");
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function leave() {
    setPending(true);
    setMessage(null);
    try {
      const result = await leaveMatchAction(readSessionId(), matchId);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      router.push("/");
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function remove(targetUserId: string) {
    setPending(true);
    setMessage(null);
    try {
      const result = await hostRemovePlayerAction(
        readSessionId(),
        matchId,
        targetUserId,
      );
      if (!result.ok) {
        fail(result.code);
        return;
      }
      commitLobby(result.data);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  const playing =
    snapshot &&
    snapshot.phase !== "lobby" &&
    snapshot.phase !== "cancelled";

  if (playing && snapshot) {
    return (
      <MatchPlay
        snapshot={snapshot}
        userId={userId}
        unavailable={unavailable}
        onLockIn={(point) => sendRef.current("lockIn", point)}
        onHome={() => router.push("/")}
        onRetry={retryRoom}
      />
    );
  }

  if (!lobby) {
    return (
      <LobbyShell title="Versus">
        <p className="text-sm text-muted-foreground">{message ?? "Loading…"}</p>
        <LobbyActions>
          <Button asChild variant="outline" className={lobbyCtaClassName}>
            <Link href="/">Home</Link>
          </Button>
        </LobbyActions>
      </LobbyShell>
    );
  }

  if (lobby.status === "cancelled") {
    return (
      <LobbyShell title="Versus">
        <p className="text-sm text-muted-foreground">
          {goneCopy ?? "This lobby was cancelled."}
        </p>
        <LobbyActions>
          <Button asChild className={lobbyCtaClassName}>
            <Link href="/">Home</Link>
          </Button>
        </LobbyActions>
      </LobbyShell>
    );
  }

  if (lobby.status === "live") {
    return (
      <LobbyShell title="Versus">
        <StatusLine tone={unavailable ? "danger" : "muted"}>
          {unavailable
            ? matchErrorMessage("unavailable")
            : (message ?? "Reconnecting…")}
        </StatusLine>
        <LobbyActions>
          {unavailable ? (
            <Button
              type="button"
              className={lobbyCtaClassName}
              onClick={retryRoom}
            >
              Retry
            </Button>
          ) : null}
          <Button asChild variant="outline" className={lobbyCtaClassName}>
            <Link href="/">Home</Link>
          </Button>
        </LobbyActions>
      </LobbyShell>
    );
  }

  return (
    <MatchLobby
      lobby={lobby}
      snapshot={snapshot}
      userId={userId}
      pending={pending}
      unavailable={unavailable}
      message={message}
      onInvite={(friendId) => void invite(friendId)}
      onAccept={() => void accept()}
      onDecline={() => void decline()}
      onStart={() => void start()}
      onLeave={() => void leave()}
      onRemove={(targetUserId) => void remove(targetUserId)}
      onRetry={retryRoom}
    />
  );
}
