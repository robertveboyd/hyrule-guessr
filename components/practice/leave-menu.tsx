"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";

import { SignOutMenuItem } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export function LeaveMenu({
  pending,
  onLeave,
  onAbandon,
}: {
  pending: boolean;
  onLeave: () => void;
  onAbandon: () => void;
}) {
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
    <div ref={rootRef} className="absolute top-3 left-3 z-30">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="border-amber/40 bg-hud text-amber"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Game menu"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu />
      </Button>
      {open ? (
        <div
          role="menu"
          className="mt-1 min-w-36 overflow-hidden rounded-md border border-amber/40 bg-hud shadow-[0_8px_40px_rgb(0_0_0_/_.55)]"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onLeave();
            }}
          >
            Leave
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-danger hover:bg-muted"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onAbandon();
            }}
          >
            Abandon
          </button>
          <SignOutMenuItem disabled={pending} />
        </div>
      ) : null}
    </div>
  );
}
