"use client";

import { BotwLeaflet } from "@/components/map/botw-leaflet";
import { cn } from "@/lib/utils";
import type { GamePoint } from "@/lib/game/crs";
import type { ReactNode } from "react";

export function GuessMap({
  guess,
  truth = null,
  opponent = null,
  interactive,
  expanded,
  onGuess,
  onPointerEnter,
  onPointerLeave,
  onActivate,
  enlargeHint,
  footer,
  className,
}: {
  guess: GamePoint | null;
  truth?: GamePoint | null;
  opponent?: GamePoint | null;
  interactive: boolean;
  expanded: boolean;
  onGuess: (point: GamePoint) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onActivate?: () => void;
  enlargeHint?: string | null;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute right-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-md border border-amber/40 bg-hud shadow-[0_8px_40px_rgb(0_0_0_/_.55)] transition-[width,height] duration-200 ease-out",
        expanded
          ? "h-[min(38rem,calc(100%-1.5rem))] w-[min(52rem,72vw)]"
          : "h-40 w-52 sm:h-48 sm:w-72",
        className,
      )}
      aria-expanded={expanded}
      aria-label="Guess map"
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="relative min-h-0 flex-1"
        onPointerDown={onActivate}
      >
        <BotwLeaflet
          className="h-full w-full"
          guess={guess}
          truth={truth}
          opponent={opponent}
          guessKind="guess"
          interactive={interactive}
          onGuess={onGuess}
          showLine={Boolean(truth)}
          showZoom={expanded}
          visible={expanded}
        />
        {!expanded && enlargeHint ? (
          <p className="pointer-events-none absolute inset-x-0 top-1.5 z-10 text-center font-heading text-[0.65rem] uppercase tracking-[0.18em] text-amber">
            {enlargeHint}
          </p>
        ) : null}
      </div>
      {footer ? (
        <div className="flex w-full shrink-0 flex-col gap-1.5 bg-hud px-2 py-1.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
