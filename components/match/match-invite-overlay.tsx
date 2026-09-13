"use client";

import { Button } from "@/components/ui/button";
import type { MatchHomeInviteDto } from "@/lib/match/types";

export function MatchInviteOverlay({
  invites,
  pending,
  onAccept,
  onDecline,
}: {
  invites: MatchHomeInviteDto[];
  pending: boolean;
  onAccept: (matchId: string) => void;
  onDecline: (matchId: string) => void;
}) {
  if (invites.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-3 right-3 z-50 flex w-[min(20rem,calc(100%-1.5rem))] flex-col gap-2"
      aria-live="polite"
      aria-label="Match invites"
    >
      {invites.map((invite) => (
        <article
          key={invite.matchId}
          className="pointer-events-auto animate-in fade-in slide-in-from-right-4 rounded-md border border-p1/40 bg-hud px-4 py-3 shadow-[0_8px_40px_rgb(0_0_0_/_.55)] duration-200"
        >
          <p className="font-heading text-lg">{invite.hostUsername}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Invited you to a match.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={() => onAccept(invite.matchId)}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => onDecline(invite.matchId)}
            >
              Decline
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
