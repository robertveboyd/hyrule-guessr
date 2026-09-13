"use client";

import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DevMapLink } from "@/components/lobby/dev-map-link";
import { cn } from "@/lib/utils";

export const lobbyCtaClassName = "w-56";

export function LobbyShell({
  title = "Hyrule Guessr",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4 pb-24">
      <h1 className="font-heading text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function StatusLine({
  children,
  tone = "muted",
}: {
  children?: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className="flex min-h-10 w-56 items-center justify-center"
      aria-live="polite"
    >
      {children ? (
        <p
          className={cn(
            "line-clamp-2 text-center text-xs",
            tone === "danger" ? "text-danger" : "text-muted-foreground",
          )}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}

export function LobbyActions({
  showMap = false,
  children,
}: {
  showMap?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {children}
      {showMap ? <DevMapLink className={lobbyCtaClassName} /> : null}
      <SignOutButton className={lobbyCtaClassName} />
    </div>
  );
}
