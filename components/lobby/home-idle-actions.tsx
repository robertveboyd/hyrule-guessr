"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { LobbyActions, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { PracticeSplitButton } from "@/components/practice/practice-split-button";
import { Button } from "@/components/ui/button";
import type { SpRunMode } from "@/lib/game/practice";

export function HomeIdleActions({
  pending,
  onStart,
}: {
  pending: boolean;
  onStart: (mode: SpRunMode) => void;
}) {
  return (
    <LobbyActions showMap>
      <PracticeSplitButton pending={pending} onStart={onStart} />
      <Button className={lobbyCtaClassName} disabled>
        Versus
      </Button>
      <Button asChild variant="outline" className={lobbyCtaClassName}>
        <Link href="/friends">Friends</Link>
      </Button>
    </LobbyActions>
  );
}

export function HomeLoading() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-amber" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
