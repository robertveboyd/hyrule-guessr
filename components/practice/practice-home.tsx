"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeIdleActions, HomeLoading } from "@/components/lobby/home-idle-actions";
import { useReportHomeReady } from "@/components/lobby/home-ready";
import { LobbyActions, LobbyShell, StatusLine, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { MatchInviteOverlay } from "@/components/match/match-invite-overlay";
import { MatchRejoinCard } from "@/components/match/match-rejoin-card";
import { useMatchHome } from "@/components/match/use-match-home";
import { Button } from "@/components/ui/button";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import type { MatchHostRole } from "@/lib/game/match";
import type { SpRunMode } from "@/lib/game/practice";
import { createMatchAction } from "@/lib/match/actions";
import { MATCH_UNEXPECTED_MESSAGE, matchErrorMessage } from "@/lib/match/error-copy";
import {
  loadPracticeHomeAction,
  startPracticeAction,
} from "@/lib/practice/actions";
import {
  PRACTICE_UNEXPECTED_MESSAGE,
  practiceErrorMessage,
} from "@/lib/practice/error-copy";
import type { PracticeHomeDto } from "@/lib/practice/types";

function subscribeClient() {
  return () => {};
}

function getClientBooted() {
  return true;
}

function getServerBooted() {
  return false;
}

export function PracticeHome() {
  const router = useRouter();
  const booted = useSyncExternalStore(
    subscribeClient,
    getClientBooted,
    getServerBooted,
  );
  const [home, setHome] = useState<PracticeHomeDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);
  const match = useMatchHome();

  const consumeHome = useCallback(
    (
      result: Awaited<ReturnType<typeof loadPracticeHomeAction>>,
      cancelled?: boolean,
    ) => {
      if (cancelled || !aliveRef.current) return;
      if (!result.ok) {
        if (result.code === "forbidden") {
          sendToLogin();
          return;
        }
        setMessage(practiceErrorMessage(result.code));
        return;
      }
      setMessage(null);
      setHome(result.data);
    },
    [],
  );

  const requestHome = useCallback(() => {
    setMessage(null);
    return loadPracticeHomeAction(readSessionId())
      .then((result) => consumeHome(result))
      .catch(() => {
        if (aliveRef.current) {
          setMessage(PRACTICE_UNEXPECTED_MESSAGE);
        }
      });
  }, [consumeHome]);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    void loadPracticeHomeAction(readSessionId())
      .then((result) => consumeHome(result, cancelled))
      .catch(() => {
        if (!cancelled) {
          setMessage(PRACTICE_UNEXPECTED_MESSAGE);
        }
      });
    return () => {
      cancelled = true;
      aliveRef.current = false;
    };
  }, [consumeHome]);

  async function start(mode: SpRunMode) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    let started = false;
    try {
      const result = await startPracticeAction(readSessionId(), mode);
      if (!result.ok) {
        if (result.code === "forbidden") {
          sendToLogin();
          return;
        }
        setMessage(practiceErrorMessage(result.code));
        return;
      }
      started = true;
      router.push("/play");
    } catch {
      setMessage(PRACTICE_UNEXPECTED_MESSAGE);
    } finally {
      if (!started) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }

  async function versus(role: MatchHostRole) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    let started = false;
    try {
      const result = await createMatchAction(readSessionId(), role);
      if (!result.ok) {
        if (result.code === "forbidden") {
          sendToLogin();
          return;
        }
        setMessage(matchErrorMessage(result.code));
        return;
      }
      started = true;
      router.push(`/match/${result.data.matchId}`);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      if (!started) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }

  const view = home;
  const active = view?.active;
  const matchReady = match.matchReady;
  const error = message ?? match.message;
  const busy = pending || match.pending;
  const rejoinCard = match.matchHome?.rejoin ? (
    <MatchRejoinCard rejoin={match.matchHome.rejoin} />
  ) : null;
  const inviteOverlay = (
    <MatchInviteOverlay
      invites={match.matchHome?.incomingInvites ?? []}
      pending={busy}
      onAccept={(matchId) => void match.acceptInvite(matchId)}
      onDecline={(matchId) => void match.declineInvite(matchId)}
    />
  );

  useReportHomeReady(
    booted &&
      ((view !== null && matchReady) || (message !== null && view === null)),
  );

  if (!booted) {
    return <div className="min-h-full flex-1" />;
  }

  if (!view || !matchReady) {
    if (message && !view) {
      return (
        <LobbyShell>
          <StatusLine tone="danger">{message}</StatusLine>
          <LobbyActions showMap>
            <Button
              type="button"
              className={lobbyCtaClassName}
              onClick={() => void requestHome()}
            >
              Retry
            </Button>
          </LobbyActions>
        </LobbyShell>
      );
    }
    return <HomeLoading />;
  }

  if (active) {
    const modeLabel = active.mode === "timed" ? "Timed" : "Casual";
    const status =
      active.phase === "summary"
        ? `${modeLabel} run — summary`
        : `${modeLabel} run in progress — round ${active.roundIndex}`;

    return (
      <>
        {inviteOverlay}
        <LobbyShell>
          <StatusLine tone="danger">{error}</StatusLine>
          <p className="text-sm text-muted-foreground">{status}</p>
          <LobbyActions showMap>
            <Button asChild className={lobbyCtaClassName}>
              <Link href="/play">Continue</Link>
            </Button>
            <Button asChild variant="outline" className={lobbyCtaClassName}>
              <Link href="/friends">Friends</Link>
            </Button>
          </LobbyActions>
          {rejoinCard}
        </LobbyShell>
      </>
    );
  }

  return (
    <>
      {inviteOverlay}
      <LobbyShell>
        <StatusLine tone={error ? "danger" : "muted"}>
          {error ??
            (match.matchHome?.rejoin
              ? match.matchHome.rejoin.status === "live"
                ? "Rejoin your match to continue."
                : "Rejoin or leave your current lobby first."
              : null)}
        </StatusLine>
        {rejoinCard}
        <HomeIdleActions
          pending={busy}
          versusDisabled={Boolean(match.matchHome?.rejoin)}
          onStart={start}
          onVersus={versus}
        />
      </LobbyShell>
    </>
  );
}
