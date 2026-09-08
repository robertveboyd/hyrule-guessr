"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { StillFrame } from "@/components/practice/still-frame";
import { LeaveMenu } from "@/components/practice/leave-menu";
import { RoundTimer } from "@/components/practice/round-timer";
import { Button } from "@/components/ui/button";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import type { GamePoint } from "@/lib/game/crs";
import { SP_LOCK_IN_GRACE_MS } from "@/lib/game/practice";
import {
  abandonPracticeAction,
  continuePracticeAction,
  finishPracticeAction,
  loadPracticeAction,
  submitPracticeGuessAction,
} from "@/lib/practice/actions";
import {
  PRACTICE_UNEXPECTED_MESSAGE,
  practiceErrorMessage,
} from "@/lib/practice/error-copy";
import type { PlayDto } from "@/lib/practice/types";

const GuessMap = dynamic(
  () => import("@/components/map/guess-map").then((mod) => mod.GuessMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute right-3 bottom-3 z-20 h-40 w-52 rounded-md border border-amber/40 bg-hud sm:h-48 sm:w-72"
        aria-hidden
      />
    ),
  },
);

const hudKickerClass =
  "font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80";
const hudValueClass = "font-heading text-xl leading-tight text-foreground";

function formatHudMeters(meters: number | null) {
  return meters === null ? "—" : `${meters.toLocaleString("en-US")} m`;
}

function useFineHover() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return fine;
}

export function PracticePlay() {
  const router = useRouter();
  const fineHover = useFineHover();
  const [play, setPlay] = useState<PlayDto | null>(null);
  const [pin, setPin] = useState<GamePoint | null>(null);
  const [hovered, setHovered] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const playRef = useRef(play);
  const pinRef = useRef(pin);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);
  const expireRetryRef = useRef<number | null>(null);
  const roundKeyRef = useRef<string | null>(null);
  const swallowGuessRef = useRef(false);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const clearExpireRetry = useCallback(() => {
    if (expireRetryRef.current === null) return;
    window.clearTimeout(expireRetryRef.current);
    expireRetryRef.current = null;
  }, []);

  const applyPlay = useCallback((next: PlayDto) => {
    if (next.phase === "guessing") {
      const key = `${next.runId}:${next.roundIndex}`;
      if (roundKeyRef.current !== key) {
        roundKeyRef.current = key;
        setPin(null);
        setSticky(false);
        setHovered(false);
      }
    } else {
      roundKeyRef.current = null;
      clearExpireRetry();
    }
    setPlay(next);
  }, [clearExpireRetry]);

  const fail = useCallback(
    (code: Parameters<typeof practiceErrorMessage>[0]) => {
      if (code === "forbidden") {
        sendToLogin();
        return;
      }
      if (code === "no-run") {
        router.replace("/");
        return;
      }
      setMessage(practiceErrorMessage(code));
    },
    [router],
  );

  const consumePlay = useCallback(
    (
      result: Awaited<ReturnType<typeof loadPracticeAction>>,
      cancelled?: boolean,
    ) => {
      if (cancelled || !aliveRef.current) return;
      if (!result.ok) {
        fail(result.code);
        return;
      }
      applyPlay(result.data);
    },
    [applyPlay, fail],
  );

  const requestPlay = useCallback(() => {
    setMessage(null);
    return loadPracticeAction(readSessionId())
      .then((result) => consumePlay(result))
      .catch(() => {
        if (aliveRef.current) {
          setMessage(PRACTICE_UNEXPECTED_MESSAGE);
        }
      });
  }, [consumePlay]);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    void loadPracticeAction(readSessionId())
      .then((result) => consumePlay(result, cancelled))
      .catch(() => {
        if (!cancelled) {
          setMessage(PRACTICE_UNEXPECTED_MESSAGE);
        }
      });
    return () => {
      cancelled = true;
      aliveRef.current = false;
      clearExpireRetry();
    };
  }, [clearExpireRetry, consumePlay]);

  const reloadExpired = useCallback(() => {
    const apply = (
      result: Awaited<ReturnType<typeof loadPracticeAction>>,
      retry: boolean,
    ) => {
      consumePlay(result);
      if (!aliveRef.current || !result.ok) return;
      if (result.data.phase !== "guessing" || !retry) return;
      clearExpireRetry();
      expireRetryRef.current = window.setTimeout(() => {
        expireRetryRef.current = null;
        void loadPracticeAction(readSessionId())
          .then((next) => apply(next, false))
          .catch(() => {
            if (aliveRef.current) {
              setMessage(PRACTICE_UNEXPECTED_MESSAGE);
            }
          });
      }, SP_LOCK_IN_GRACE_MS);
    };
    void loadPracticeAction(readSessionId())
      .then((result) => apply(result, true))
      .catch(() => {
        if (aliveRef.current) {
          setMessage(PRACTICE_UNEXPECTED_MESSAGE);
        }
      });
  }, [clearExpireRetry, consumePlay]);

  const runMutation = useCallback(async (work: () => Promise<void>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      await work();
    } catch {
      setMessage(PRACTICE_UNEXPECTED_MESSAGE);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  const lockIn = useCallback(async () => {
    const currentPin = pinRef.current;
    if (!currentPin) return;
    await runMutation(async () => {
      const result = await submitPracticeGuessAction(
        readSessionId(),
        currentPin.x,
        currentPin.z,
      );
      if (!result.ok) {
        fail(result.code);
        return;
      }
      applyPlay(result.data);
    });
  }, [applyPlay, fail, runMutation]);

  const continueRun = useCallback(async () => {
    await runMutation(async () => {
      const result = await continuePracticeAction(readSessionId());
      if (!result.ok) {
        fail(result.code);
        return;
      }
      applyPlay(result.data);
    });
  }, [applyPlay, fail, runMutation]);

  async function leave() {
    router.push("/");
  }

  async function abandon() {
    await runMutation(async () => {
      const result = await abandonPracticeAction(readSessionId());
      if (!result.ok) {
        fail(result.code);
        return;
      }
      router.push("/");
    });
  }

  async function done() {
    await runMutation(async () => {
      const result = await finishPracticeAction(readSessionId());
      if (!result.ok) {
        fail(result.code);
        return;
      }
      router.push("/");
    });
  }

  const placePin = useCallback((point: GamePoint) => {
    if (swallowGuessRef.current) return;
    setPin(point);
  }, []);

  const activateMap = useCallback(() => {
    swallowGuessRef.current = true;
    setSticky(true);
    window.setTimeout(() => {
      swallowGuessRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      const phase = playRef.current?.phase;
      if (event.key === "m" || event.key === "M") {
        if (phase !== "guessing") return;
        event.preventDefault();
        setSticky((open) => !open);
        return;
      }
      if (event.key !== " " && event.code !== "Space") return;
      if (target instanceof HTMLElement && target.closest("button")) return;
      if (phase === "guessing") {
        event.preventDefault();
        void lockIn();
        return;
      }
      if (phase === "reveal") {
        event.preventDefault();
        void continueRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [continueRun, lockIn]);

  if (!play) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-sm text-muted-foreground">
        <p>{message ?? "Loading…"}</p>
        {message ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => void requestPlay()}>
              Retry
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Home
            </Button>
          </div>
        ) : null}
        <SignOutButton />
      </div>
    );
  }

  if (play.phase === "summary") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
        {message ? (
          <p className="mb-4 text-center text-sm text-danger">{message}</p>
        ) : null}
        <div className="w-full max-w-md rounded-md border border-amber/40 bg-hud p-4 shadow-[0_8px_40px_rgb(0_0_0_/_.55)]">
          <p className={`${hudKickerClass} text-center`}>
            {play.mode === "timed" ? "Timed" : "Casual"}
          </p>
          <p className={`${hudValueClass} mt-3 text-center`}>
            {play.total.toLocaleString("en-US")} /{" "}
            {play.totalMax.toLocaleString("en-US")}
          </p>
          <div className="mt-4 border-t border-amber/30 pt-3">
            <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-x-2 px-1 pb-2 text-center">
              <p className={hudKickerClass}>Round</p>
              <p className={hudKickerClass}>Score</p>
              <p className={hudKickerClass}>Distance</p>
            </div>
            <ul className="divide-y divide-amber/20">
              {play.rounds.map((round) => (
                <li
                  key={round.roundIndex}
                  className="grid grid-cols-[2.75rem_1fr_1fr] gap-x-2 px-1 py-2 text-center"
                >
                  <span className={hudValueClass}>{round.roundIndex}</span>
                  <span className={hudValueClass}>
                    {round.score.toLocaleString("en-US")}
                  </span>
                  <span className={hudValueClass}>
                    {formatHudMeters(round.distanceMeters)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => void done()}
          >
            Done
          </Button>
        </div>
        <SignOutButton className="mt-6" disabled={pending} />
      </div>
    );
  }

  const guessing = play.phase === "guessing";
  const guessPoint = guessing ? pin : play.guess;
  const truthPoint = guessing ? null : play.truth;
  const expanded = !guessing || sticky || (fineHover && hovered);
  const mapInteractive = guessing && (expanded || fineHover);
  const mapActionClassName =
    "h-auto min-h-8 w-full whitespace-normal px-2 py-1.5 text-center";

  return (
    <div className="relative h-svh overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        onClick={() => {
          setSticky(false);
          setHovered(false);
        }}
      >
        <StillFrame src={play.imageUrl} />
      </div>

      <LeaveMenu
        pending={pending}
        onLeave={() => void leave()}
        onAbandon={() => void abandon()}
      />

      {guessing && play.mode === "timed" ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-md border border-amber/40 bg-hud px-3 py-1">
          <RoundTimer
            key={play.endsAt ?? "casual"}
            endsAt={play.endsAt}
            onExpire={reloadExpired}
            className="text-3xl"
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute top-3 right-3 z-30 grid w-56 grid-cols-2 gap-4 rounded-md border border-amber/40 bg-hud px-3 py-1.5">
        <div>
          <p className="font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80">
            Round
          </p>
          <p className="font-heading text-xl leading-tight text-foreground">
            {play.roundIndex}/{play.roundCount}
          </p>
        </div>
        <div>
          <p className="font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80">
            Score
          </p>
          <p className="font-heading text-xl leading-tight text-foreground">
            {play.total.toLocaleString("en-US")}
          </p>
        </div>
      </div>

      {message ? (
        <p className="absolute top-16 right-3 left-3 z-30 text-center text-sm text-danger drop-shadow-[0_1px_8px_rgb(0_0_0_/_0.85)]">
          {message}
        </p>
      ) : null}

      <GuessMap
        guess={guessPoint}
        truth={truthPoint}
        interactive={mapInteractive}
        expanded={expanded}
        onGuess={placePin}
        onPointerEnter={
          fineHover && guessing ? () => setHovered(true) : undefined
        }
        onPointerLeave={
          fineHover && guessing ? () => setHovered(false) : undefined
        }
        onActivate={
          !fineHover && guessing && !expanded ? activateMap : undefined
        }
        footer={
          guessing ? (
            <Button
              type="button"
              className={mapActionClassName}
              disabled={pending || !pin}
              onClick={() => void lockIn()}
            >
              {pin ? "Guess" : "Place your pin on the map"}
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-2 divide-x divide-amber/30">
                <div className="px-2 text-center">
                  <p className={hudKickerClass}>Score</p>
                  <p className={hudValueClass}>
                    {play.score.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="px-2 text-center">
                  <p className={hudKickerClass}>Distance</p>
                  <p className={hudValueClass}>
                    {formatHudMeters(play.distanceMeters)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className={mapActionClassName}
                disabled={pending}
                onClick={() => void continueRun()}
              >
                Done
              </Button>
            </>
          )
        }
      />
    </div>
  );
}
