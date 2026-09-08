"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LobbyActions, LobbyShell, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { PracticeSplitButton } from "@/components/practice/practice-split-button";
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
import type { PracticeHomeDto } from "@/lib/practice/types";

export function PracticeHome() {
  const router = useRouter();
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

  const active = home?.active;

  if (!home) {
    return (
      <LobbyShell>
        {message ? (
          <>
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
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Loading…</p>
            <LobbyActions showMap />
          </>
        )}
      </LobbyShell>
    );
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
        </LobbyActions>
      </LobbyShell>
    );
  }

  return (
    <LobbyShell>
      {message ? (
        <p className="max-w-sm text-center text-sm text-danger">{message}</p>
      ) : null}
      <LobbyActions showMap>
        <PracticeSplitButton pending={pending} onStart={start} />
        <Button className={lobbyCtaClassName} disabled>
          Versus
        </Button>
      </LobbyActions>
    </LobbyShell>
  );
}
