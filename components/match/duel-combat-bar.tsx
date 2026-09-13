"use client";

import { MATCH_MULTIPLIER_STEP, MATCH_START_HEALTH } from "@/lib/game/match";
import { scoreGuess } from "@/lib/game/score";
import type { MatchSnapshot } from "@/lib/match/protocol";
import { cn } from "@/lib/utils";

export function formatMultiplier(value: number | null | undefined) {
  if (value == null) return "1×";
  const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${label}×`;
}

function formatMeters(meters: number | null) {
  return meters == null ? "—" : `${meters.toLocaleString("en-US")} m`;
}

function seatSide(
  snapshot: MatchSnapshot,
  you: "a" | "b" | "observer",
  side: "left" | "right",
) {
  const youOnLeft = you !== "b";
  const isA = side === "left" ? youOnLeft : !youOnLeft;
  const seat = isA ? snapshot.playerA : snapshot.playerB;
  const key = isA ? ("a" as const) : ("b" as const);
  return { seat, key, isYou: you === key };
}

function roundDistance(snapshot: MatchSnapshot, key: "a" | "b") {
  const reveal = snapshot.reveal;
  if (!reveal) return null;
  const guess = key === "a" ? reveal.guessA : reveal.guessB;
  if (!guess) return null;
  return scoreGuess(guess, reveal.truth).distanceMeters;
}

export function DuelCombatBar({
  snapshot,
  you,
}: {
  snapshot: MatchSnapshot;
  you: "a" | "b" | "observer";
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 grid grid-cols-2 gap-2">
      <DuelFighterCard snapshot={snapshot} you={you} side="left" tone="p1" />
      <DuelFighterCard snapshot={snapshot} you={you} side="right" tone="p2" />
    </div>
  );
}

function DuelFighterCard({
  snapshot,
  you,
  side,
  tone,
}: {
  snapshot: MatchSnapshot;
  you: "a" | "b" | "observer";
  side: "left" | "right";
  tone: "p1" | "p2";
}) {
  const { seat, key, isYou } = seatSide(snapshot, you, side);
  const reveal = snapshot.reveal;
  const health = seat.health ?? 0;
  const pct = Math.max(0, Math.min(100, (health / MATCH_START_HEALTH) * 100));
  const score = reveal ? (key === "a" ? reveal.scoreA : reveal.scoreB) : null;
  const distance = roundDistance(snapshot, key);
  const roundFx =
    snapshot.phase === "betweenRounds" || snapshot.phase === "scoring";
  const tookHit = Boolean(
    roundFx && reveal && reveal.loser === key && reveal.damage > 0,
  );
  const gainedMult = Boolean(
    roundFx && reveal && (reveal.loser == null || reveal.loser !== key),
  );
  const guessing =
    snapshot.phase === "playing" || snapshot.phase === "grace";
  const reconnecting = guessing && !reveal && !seat.connected;
  const guessed = guessing && !reveal && seat.locked;

  return (
    <div
      className={cn(
        "relative rounded-md border bg-hud/95 px-3 py-2 shadow-[0_8px_40px_rgb(0_0_0_/_.55)]",
        tone === "p1" ? "border-p1/40" : "border-p2/40",
        tookHit && "border-danger/70",
      )}
    >
      {tookHit ? (
        <p className="absolute -top-2 right-2 rounded-md bg-danger px-1.5 py-0.5 font-heading text-xs text-white">
          −{reveal?.damage}
        </p>
      ) : null}
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-heading text-sm">
          {isYou ? "You" : (seat.username ?? (key === "a" ? "A" : "B"))}
        </p>
        <p
          className={cn(
            "tabular-nums text-sm",
            tone === "p1" ? "text-p1" : "text-p2",
          )}
        >
          {formatMultiplier(seat.multiplier)}
          {gainedMult ? (
            <span className="ml-1 text-xs text-foreground/80">
              +{MATCH_MULTIPLIER_STEP.toFixed(1)}×
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/50">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            health === 0 ? "bg-danger" : tone === "p1" ? "bg-p1" : "bg-p2",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="tabular-nums text-sm text-foreground">{health}</p>
        {reveal ? (
          <p className="text-xs text-muted-foreground">
            {score?.toLocaleString("en-US")} · {formatMeters(distance)}
          </p>
        ) : reconnecting && !guessed ? (
          <p className="text-xs text-danger">Reconnecting…</p>
        ) : guessed ? (
          <p className={cn("text-xs", tone === "p1" ? "text-p1" : "text-p2")}>
            Guessed
          </p>
        ) : (
          <p className="font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80">
            HP
          </p>
        )}
      </div>
    </div>
  );
}
