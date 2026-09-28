"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { DuelCombatBar } from "@/components/match/duel-combat-bar";
import { MatchMenu } from "@/components/match/match-menu";
import { useFineHover } from "@/components/map/use-fine-hover";
import { StillFrame } from "@/components/practice/still-frame";
import { RoundTimer, useRemainingMs } from "@/components/practice/round-timer";
import { Button } from "@/components/ui/button";
import type { GamePoint } from "@/lib/game/crs";
import {
  matchEndingAfterReveal,
  matchRecap,
  playTimerHint,
  roundVerdict,
  seatReconnecting,
} from "@/lib/match/copy";
import type { MatchSnapshot } from "@/lib/match/protocol";
import { mapEnlargeHint } from "@/lib/practice/copy";
import { cn } from "@/lib/utils";

const GuessMap = dynamic(
  () => import("@/components/map/guess-map").then((mod) => mod.GuessMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute right-3 bottom-[6.75rem] z-20 h-40 w-52 rounded-md border border-amber/40 bg-hud sm:h-48 sm:w-72"
        aria-hidden
      />
    ),
  },
);

const hudKickerClass =
  "font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80";
const hudValueClass = "font-heading text-xl leading-tight text-foreground";
const mapActionClassName =
  "h-auto min-h-8 w-full whitespace-normal px-2 py-1.5 text-center";
const mapLiftClass = "bottom-[6.75rem]";

function seatLabel(snapshot: MatchSnapshot, userId: string) {
  if (snapshot.playerA.userId === userId) return "a";
  if (snapshot.playerB.userId === userId) return "b";
  return "observer";
}

export function MatchPlay({
  snapshot,
  userId,
  unavailable,
  onLockIn,
  onHome,
  onRetry,
}: {
  snapshot: MatchSnapshot;
  userId: string;
  unavailable: boolean;
  onLockIn: (point: GamePoint) => void;
  onHome: () => void;
  onRetry?: () => void;
}) {
  const fineHover = useFineHover();
  const [mapUi, setMapUi] = useState({
    round: snapshot.roundIndex,
    pin: null as GamePoint | null,
    sticky: false,
    hovered: false,
  });
  const swallowGuessRef = useRef(false);
  if (mapUi.round !== snapshot.roundIndex) {
    setMapUi({
      round: snapshot.roundIndex,
      pin: null,
      sticky: false,
      hovered: false,
    });
  }
  const pin = mapUi.round === snapshot.roundIndex ? mapUi.pin : null;
  const sticky = mapUi.round === snapshot.roundIndex && mapUi.sticky;
  const hovered = mapUi.round === snapshot.roundIndex && mapUi.hovered;
  const you = seatLabel(snapshot, userId);
  const observer = you === "observer";
  const guessing =
    (snapshot.phase === "playing" || snapshot.phase === "grace") &&
    !snapshot.youLocked &&
    snapshot.youCanLock;
  const reveal = snapshot.reveal;
  const expanded = Boolean(reveal) || sticky || (fineHover && hovered);
  const mapInteractive = guessing && (expanded || fineHover);
  const endsAtIso = snapshot.endsAt
    ? new Date(snapshot.endsAt).toISOString()
    : null;
  const remaining = useRemainingMs(endsAtIso);
  const reconnecting = seatReconnecting(snapshot);
  const timerHint = playTimerHint({
    phase: snapshot.phase,
    observer,
    youLocked: snapshot.youLocked,
    reconnecting,
  });
  const urgent =
    (snapshot.phase === "playing" || snapshot.phase === "grace") &&
    remaining > 0 &&
    remaining <= 15_000;
  const ending = reveal
    ? matchEndingAfterReveal({
        healthA: snapshot.playerA.health ?? 0,
        healthB: snapshot.playerB.health ?? 0,
        roundIndex: snapshot.roundIndex,
        roundCount: snapshot.roundCount,
      })
    : false;
  const verdict = reveal
    ? roundVerdict({
        you,
        loser: reveal.loser,
        playerAName: snapshot.playerA.username ?? "A",
        playerBName: snapshot.playerB.username ?? "B",
      })
    : null;

  const lockIn = useCallback(() => {
    if (!pin || snapshot.youLocked) return;
    onLockIn(pin);
  }, [onLockIn, pin, snapshot.youLocked]);

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
      if (event.key === "m" || event.key === "M") {
        if (!guessing) return;
        event.preventDefault();
        setMapUi((current) => ({ ...current, sticky: !current.sticky }));
        return;
      }
      if (event.key !== " " && event.code !== "Space") return;
      if (target instanceof HTMLElement && target.closest("button")) return;
      if (!guessing) return;
      event.preventDefault();
      lockIn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guessing, lockIn]);

  const yourGuess =
    you === "a"
      ? reveal?.guessA ?? pin
      : you === "b"
        ? reveal?.guessB ?? pin
        : (reveal?.guessA ?? null);
  const opponentGuess =
    you === "a"
      ? reveal?.guessB ?? null
      : you === "b"
        ? reveal?.guessA ?? null
        : (reveal?.guessB ?? null);

  const placePin = useCallback(
    (point: GamePoint) => {
      if (swallowGuessRef.current) return;
      if (!guessing || observer) return;
      setMapUi((current) => ({
        ...current,
        round: snapshot.roundIndex,
        pin: point,
      }));
    },
    [guessing, observer, snapshot.roundIndex],
  );

  const activateMap = useCallback(() => {
    swallowGuessRef.current = true;
    setMapUi((current) => ({ ...current, sticky: true }));
    window.setTimeout(() => {
      swallowGuessRef.current = false;
    }, 0);
  }, []);

  if (snapshot.phase === "over") {
    const winnerName =
      snapshot.winnerUserId === snapshot.playerA.userId
        ? snapshot.playerA.username
        : snapshot.winnerUserId === snapshot.playerB.userId
          ? snapshot.playerB.username
          : null;
    const headline = !snapshot.winnerUserId
      ? "Draw"
      : observer
        ? `${winnerName ?? "Winner"} wins`
        : snapshot.winnerUserId === userId
          ? "You win"
          : "You lose";
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-4 px-4 pb-36">
        <p className="font-heading text-4xl">{headline}</p>
        <p className="text-sm text-muted-foreground">
          {matchRecap({
            you,
            winnerUserId: snapshot.winnerUserId,
            healthA: snapshot.playerA.health ?? 0,
            healthB: snapshot.playerB.health ?? 0,
          })}
        </p>
        <Button type="button" onClick={onHome}>
          Home
        </Button>
        <DuelCombatBar snapshot={snapshot} you={you} />
      </div>
    );
  }

  return (
    <div className="relative h-svh overflow-hidden bg-black">
      {snapshot.imageUrl ? (
        <div
          className="absolute inset-0"
          onClick={() => {
            setMapUi((current) => ({
              ...current,
              sticky: false,
              hovered: false,
            }));
          }}
        >
          <StillFrame src={snapshot.imageUrl} />
        </div>
      ) : null}

      {urgent ? (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: "inset 0 0 120px 28px rgb(224 86 69 / 0.32)" }}
          aria-hidden
        />
      ) : null}

      <MatchMenu onHome={onHome} />

      {snapshot.phase === "betweenRounds" && verdict ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-30 w-max max-w-[calc(100%-7rem)] -translate-x-1/2 rounded-md border border-amber/40 bg-hud px-4 py-2 text-center">
          <p className={hudValueClass}>{verdict}</p>
          <p className={`${hudKickerClass} mt-1`}>
            {ending ? "Match over" : "Next round"}
          </p>
          <RoundTimer
            key={endsAtIso ?? "next"}
            endsAt={endsAtIso}
            className="mt-1 text-2xl text-amber"
          />
        </div>
      ) : snapshot.phase === "playing" || snapshot.phase === "grace" ? (
        <div className="pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-md border border-amber/40 bg-hud px-3 py-1 text-center">
          {timerHint ? (
            <p className={hudKickerClass}>{timerHint}</p>
          ) : null}
          <RoundTimer
            key={endsAtIso ?? "none"}
            endsAt={endsAtIso}
            className="text-3xl"
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute top-3 right-3 z-30 rounded-md border border-amber/40 bg-hud px-3 py-1.5">
        <p className={hudKickerClass}>Round</p>
        <p className={cn(hudValueClass, "text-center")}>
          {snapshot.roundIndex}/{snapshot.roundCount}
        </p>
      </div>

      {unavailable ? (
        <div className="absolute top-16 left-3 z-30 flex flex-col items-start gap-2">
          <p className="text-sm text-danger">Can&apos;t reach the match server.</p>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <GuessMap
        guess={yourGuess}
        truth={reveal?.truth ?? null}
        opponent={opponentGuess}
        interactive={mapInteractive}
        expanded={expanded}
        className={cn(
          mapLiftClass,
          expanded && "h-[min(38rem,calc(100%-8rem))] w-[min(52rem,72vw)]",
        )}
        onGuess={placePin}
        onPointerEnter={
          fineHover && guessing
            ? () => setMapUi((current) => ({ ...current, hovered: true }))
            : undefined
        }
        onPointerLeave={
          fineHover && guessing
            ? () => setMapUi((current) => ({ ...current, hovered: false }))
            : undefined
        }
        onActivate={
          !fineHover && guessing && !expanded ? activateMap : undefined
        }
        enlargeHint={guessing && !expanded ? mapEnlargeHint(fineHover) : null}
        footer={
          guessing ? (
            <Button
              type="button"
              className={mapActionClassName}
              disabled={!pin || snapshot.youLocked}
              onClick={() => lockIn()}
            >
              {pin ? "Guess (Space)" : "Place your pin on the map"}
            </Button>
          ) : snapshot.youLocked && !reveal ? (
            <p className="text-center text-xs text-muted-foreground">
              Waiting for opponent
            </p>
          ) : null
        }
      />

      <DuelCombatBar snapshot={snapshot} you={you} />
    </div>
  );
}
