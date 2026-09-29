"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { LobbyActions, lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { Button } from "@/components/ui/button";

export function HomeIdleActions({
  pending,
  versusDisabled = false,
  onStart,
  onVersus,
}: {
  pending: boolean;
  versusDisabled?: boolean;
  onStart: () => void;
  onVersus: () => void;
}) {
  return (
    <LobbyActions showMap>
      <Button
        type="button"
        className={lobbyCtaClassName}
        disabled={pending}
        onClick={onStart}
      >
        Practice
      </Button>
      <Button
        type="button"
        className={lobbyCtaClassName}
        disabled={pending || versusDisabled}
        onClick={onVersus}
      >
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
