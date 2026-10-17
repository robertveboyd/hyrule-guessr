"use client";

import dynamic from "next/dynamic";

import { DuelCombatBar, formatMultiplier } from "@/components/match/duel-combat-bar";
import { InviteMenu } from "@/components/match/match-lobby";
import { MatchMenu } from "@/components/match/match-menu";
import { StillFrame } from "@/components/practice/still-frame";
import { RoundTimer, useRemainingMs } from "@/components/practice/round-timer";
import { Button } from "@/components/ui/button";
import {
  matchEndingAfterReveal,
  playTimerHint,
  roundVerdict,
  seatReconnecting,
} from "@/lib/match/copy";
import type { MatchSnapshot, MatchViewport } from "@/lib/match/protocol";
import type { MatchLobbyDto } from "@/lib/match/types";
import { cn } from "@/lib/utils";

const BotwLeaflet = dynamic(
  () => import("@/components/map/botw-leaflet").then((mod) => mod.BotwLeaflet),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-black" aria-hidden />,
  },
);

const hudKickerClass =
  "font-heading text-[0.65rem] leading-none uppercase tracking-[0.18em] text-foreground/80";
const hudValueClass = "font-heading text-xl leading-tight text-foreground";

function WatchMap({
  label,
  tone,
  view,
  reveal,
}: {
  label: string;
  tone: "p1" | "p2";
  view: MatchViewport | null | undefined;
  reveal: MatchSnapshot["reveal"];
}) {
  const livePin = view?.pin ?? null;
  return (
    <div
      className={cn(
        "relative min-h-40 overflow-hidden rounded-md border bg-black",
        tone === "p1" ? "border-p1/40" : "border-p2/40",
      )}
    >
      <p
        className={cn(
          "pointer-events-none absolute top-2 left-2 z-10 rounded-md bg-hud/90 px-2 py-0.5 font-heading text-xs",
          tone === "p1" ? "text-p1" : "text-p2",
        )}
      >
        {label}
      </p>
      <BotwLeaflet
        className="h-full w-full"
        guess={reveal ? (reveal.guessA ?? null) : livePin}
        opponent={reveal ? (reveal.guessB ?? null) : null}
        truth={reveal?.truth ?? null}
        guessKind={reveal || tone === "p1" ? "guess" : "opponent"}
        interactive={false}
        follow={reveal ? null : view ?? null}
        showLine={Boolean(reveal)}
        showZoom={false}
        visible
      />
    </div>
  );
}

export function MatchWatch({
  snapshot,
  unavailable,
  friends,
  pending,
  isHost,
  onHome,
  onRetry,
  onInviteWatch,
}: {
  snapshot: MatchSnapshot;
  unavailable: boolean;
  friends: MatchLobbyDto["friends"];
  pending: boolean;
  isHost: boolean;
  onHome: () => void;
  onRetry?: () => void;
  onInviteWatch: (friendId: string) => void;
}) {
  const endsAtIso = snapshot.endsAt
    ? new Date(snapshot.endsAt).toISOString()
    : null;
  const remaining = useRemainingMs(endsAtIso);
  const reconnecting = seatReconnecting(snapshot);
  const timerHint = playTimerHint({
    phase: snapshot.phase,
    observer: true,
    youLocked: false,
    reconnecting,
  });
  const urgent =
    (snapshot.phase === "playing" || snapshot.phase === "grace") &&
    remaining > 0 &&
    remaining <= 15_000;
  const ending = snapshot.reveal
    ? matchEndingAfterReveal({
        healthA: snapshot.playerA.health ?? 0,
        healthB: snapshot.playerB.health ?? 0,
        roundIndex: snapshot.roundIndex,
        roundCount: snapshot.roundCount,
      })
    : false;
  const verdict = snapshot.reveal
    ? roundVerdict({
        you: "observer",
        loser: snapshot.reveal.loser,
        playerAName: snapshot.playerA.username ?? "A",
        playerBName: snapshot.playerB.username ?? "B",
      })
    : null;
  const watchInviteable = friends.filter(
    (friend) => friend.online && !friend.busy,
  );

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-black">
      {urgent ? (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: "inset 0 0 120px 28px rgb(224 86 69 / 0.32)" }}
          aria-hidden
        />
      ) : null}

      <MatchMenu onHome={onHome} />

      <div className="relative z-20 flex shrink-0 items-center justify-center gap-4 px-16 pt-3 pb-2">
        <div className="rounded-md border border-amber/40 bg-hud px-3 py-1 text-center">
          <p className={hudKickerClass}>Round</p>
          <p className={hudValueClass}>
            {snapshot.roundIndex}/{snapshot.roundCount}
          </p>
        </div>
        <div className="rounded-md border border-p1/40 bg-hud px-3 py-1 text-center">
          <p className={`${hudKickerClass} text-p1`}>
            {snapshot.playerA.username ?? "A"}
          </p>
          <p className={cn(hudValueClass, "text-p1")}>
            {formatMultiplier(snapshot.playerA.multiplier)}
          </p>
        </div>
        <div className="rounded-md border border-p2/40 bg-hud px-3 py-1 text-center">
          <p className={`${hudKickerClass} text-p2`}>
            {snapshot.playerB.username ?? "B"}
          </p>
          <p className={cn(hudValueClass, "text-p2")}>
            {formatMultiplier(snapshot.playerB.multiplier)}
          </p>
        </div>
        {snapshot.phase === "playing" || snapshot.phase === "grace" ? (
          <div className="rounded-md border border-amber/40 bg-hud px-3 py-1 text-center">
            {timerHint ? <p className={hudKickerClass}>{timerHint}</p> : null}
            <RoundTimer
              key={endsAtIso ?? "none"}
              endsAt={endsAtIso}
              className="text-2xl"
            />
          </div>
        ) : null}
        {isHost && watchInviteable.length > 0 ? (
          <div className="absolute top-3 right-3 z-30 w-40">
            <InviteMenu
              friends={watchInviteable}
              pending={pending}
              tone="p1"
              label="Invite to watch"
              onInvite={onInviteWatch}
            />
          </div>
        ) : null}
      </div>

      {snapshot.phase === "betweenRounds" && verdict ? (
        <div className="pointer-events-none absolute top-16 left-1/2 z-[1100] w-max max-w-[calc(100%-7rem)] -translate-x-1/2 rounded-md border border-amber/40 bg-hud px-4 py-2 text-center">
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
      ) : null}

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

      <div className="relative z-0 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(10rem,22vh)_minmax(10rem,22vh)] gap-2 px-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:grid-rows-2">
        <div className="relative min-h-40 overflow-hidden rounded-md border border-amber/40 md:row-span-2">
          {snapshot.imageUrl ? <StillFrame src={snapshot.imageUrl} /> : null}
        </div>
        <WatchMap
          label={snapshot.playerA.username ?? "A"}
          tone="p1"
          view={snapshot.viewA}
          reveal={snapshot.reveal}
        />
        <WatchMap
          label={snapshot.playerB.username ?? "B"}
          tone="p2"
          view={snapshot.viewB}
          reveal={snapshot.reveal}
        />
      </div>

      <DuelCombatBar snapshot={snapshot} you="observer" layout="band" />
    </div>
  );
}
