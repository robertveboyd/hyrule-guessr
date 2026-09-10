"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeIdleActions, HomeLoading } from "@/components/lobby/home-idle-actions";
import { useReportHomeReady } from "@/components/lobby/home-ready";
import { LobbyActions, LobbyShell, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { Button } from "@/components/ui/button";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import type { SpRunMode } from "@/lib/game/practice";
import {
  loadPracticeHomeAction,
  startPracticeAction,
} from "@/lib/practice/actions";
import {
  PRACTICE_UNEXPECTED_MESSAGE,
  practiceErrorMessage,
} from "@/lib/practice/error-copy";
import {
  clearLastPracticeHome,
  readLastPracticeHome,
  subscribeLastPracticeHome,
  writeLastPracticeHome,
} from "@/lib/practice/last-home";
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

function getServerHome() {
  return null;
}

export function PracticeHome() {
  const router = useRouter();
  const booted = useSyncExternalStore(
    subscribeClient,
    getClientBooted,
    getServerBooted,
  );
  const cached = useSyncExternalStore(
    subscribeLastPracticeHome,
    readLastPracticeHome,
    getServerHome,
  );
  const [home, setHome] = useState<PracticeHomeDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);

  const consumeHome = useCallback(
    (
      result: Awaited<ReturnType<typeof loadPracticeHomeAction>>,
      cancelled?: boolean,
    ) => {
      if (cancelled || !aliveRef.current) return;
      if (!result.ok) {
        if (result.code === "forbidden") {
          clearLastPracticeHome();
          sendToLogin();
          return;
        }
        setMessage(practiceErrorMessage(result.code));
        return;
      }
      setMessage(null);
      writeLastPracticeHome(result.data);
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
          clearLastPracticeHome();
          sendToLogin();
          return;
        }
        setMessage(practiceErrorMessage(result.code));
        return;
      }
      writeLastPracticeHome({
        active: { mode, roundIndex: 1, phase: "guessing" },
      });
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

  const view = home ?? cached;
  const active = view?.active;
  useReportHomeReady(booted && (view !== null || message !== null));

  if (!booted) {
    return <div className="min-h-full flex-1" />;
  }

  if (!view) {
    if (message) {
      return (
        <LobbyShell>
          <p className="max-w-sm text-center text-sm text-danger">{message}</p>
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
      <LobbyShell>
        {message ? (
          <p className="max-w-sm text-center text-sm text-danger">{message}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{status}</p>
        <LobbyActions showMap>
          <Button asChild className={lobbyCtaClassName}>
            <Link href="/play">Continue</Link>
          </Button>
          <Button asChild variant="outline" className={lobbyCtaClassName}>
            <Link href="/friends">Friends</Link>
          </Button>
        </LobbyActions>
      </LobbyShell>
    );
  }

  return (
    <LobbyShell>
      {message ? (
        <p className="max-w-sm text-center text-sm text-danger">{message}</p>
      ) : null}
      <HomeIdleActions pending={pending} onStart={start} />
    </LobbyShell>
  );
}
