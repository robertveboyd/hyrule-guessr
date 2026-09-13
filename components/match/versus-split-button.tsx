"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { Button } from "@/components/ui/button";
import { MATCH_HOST_ROLES, type MatchHostRole } from "@/lib/game/match";

const ROLE_LABEL: Record<MatchHostRole, string> = {
  player: "Play",
  observer: "Host",
};

export function VersusSplitButton({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (role: MatchHostRole) => void;
}) {
  const [role, setRole] = useState<MatchHostRole>("player");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${lobbyCtaClassName}`}>
      <div className="flex overflow-hidden rounded-lg">
        <Button
          type="button"
          className="min-w-0 flex-1 rounded-none"
          disabled={pending}
          onClick={() => onCreate(role)}
        >
          Versus: {ROLE_LABEL[role]}
        </Button>
        <Button
          type="button"
          size="icon"
          className="rounded-none border-l border-primary-foreground/25"
          disabled={pending}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Choose versus role"
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown className={open ? "rotate-180" : undefined} />
        </Button>
      </div>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-md"
        >
          {MATCH_HOST_ROLES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={role === option}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              disabled={pending}
              onClick={() => {
                setRole(option);
                setOpen(false);
              }}
            >
              {ROLE_LABEL[option]}
              {role === option ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <span className="size-4" aria-hidden />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
