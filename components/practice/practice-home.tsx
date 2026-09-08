"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import {
  abandonPracticeAction,
  loadPracticeHomeAction,
  startPracticeAction,
} from "@/lib/practice/actions";
import {
  PRACTICE_UNEXPECTED_MESSAGE,
  practiceErrorMessage,
} from "@/lib/practice/error-copy";
import type { PracticeHomeDto } from "@/lib/practice/types";
import type { SpRunMode } from "@/lib/game/practice";

function DevMapButton() {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <Button asChild variant="outline">
      <Link href="/map">Map</Link>
    </Button>
  );
}

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

  async function abandon() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await abandonPracticeAction(readSessionId());
      if (!result.ok) {
        if (result.code === "forbidden") {
          sendToLogin();
          return;
        }
        setMessage(practiceErrorMessage(result.code));
        return;
      }
      setHome({ active: null });
    } catch {
      setMessage(PRACTICE_UNEXPECTED_MESSAGE);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const active = home?.active;

  if (!home) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4">
        <h1 className="font-heading text-3xl">Hyrule Guessr</h1>
        {message ? (
          <>
            <p className="max-w-sm text-center text-sm text-danger">{message}</p>
            <Button type="button" onClick={() => void requestHome()}>
              Retry
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        <DevMapButton />
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-heading text-3xl">Hyrule Guessr</h1>
      {message ? (
        <p className="max-w-sm text-center text-sm text-danger">{message}</p>
      ) : null}
      {active ? (
        <p className="text-sm text-muted-foreground">
          {active.mode === "timed" ? "Timed" : "Casual"} run in progress — round{" "}
          {active.roundIndex}
          {active.phase === "summary" ? " (summary)" : ""}.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {active ? (
          <Button disabled={pending} onClick={() => router.push("/play")}>
            Resume
          </Button>
        ) : null}
        <Button
          disabled={pending}
          onClick={() => void start("casual")}
        >
          Casual
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => void start("timed")}
        >
          Timed
        </Button>
        {active ? (
          <Button
            disabled={pending}
            variant="destructive"
            onClick={() => void abandon()}
          >
            Abandon
          </Button>
        ) : null}
        <DevMapButton />
      </div>
      <SignOutButton />
    </div>
  );
}
