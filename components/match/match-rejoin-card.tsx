"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { MatchHomeRejoinDto } from "@/lib/match/types";

export function MatchRejoinCard({ rejoin }: { rejoin: MatchHomeRejoinDto }) {
  return (
    <div className="w-full max-w-sm rounded-md border border-amber/40 bg-hud px-4 py-3">
      <p className="font-heading text-lg">
        {rejoin.status === "live" ? "Match in progress" : "Lobby waiting"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Rejoin to pick up where you left off.
      </p>
      <Button asChild className="mt-3 w-full">
        <Link href={`/match/${rejoin.matchId}`}>Rejoin</Link>
      </Button>
    </div>
  );
}
