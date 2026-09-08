"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown } from "lucide-react";

import { lobbyCtaClassName } from "@/components/lobby/lobby-shell";
import { Button } from "@/components/ui/button";
import { SP_RUN_MODES, type SpRunMode } from "@/lib/game/practice";
import {
  DEFAULT_PRACTICE_MODE,
  readLastPracticeMode,
  subscribeLastPracticeMode,
  writeLastPracticeMode,
} from "@/lib/practice/last-mode";

const MODE_LABEL: Record<SpRunMode, string> = {
  casual: "Casual",
  timed: "Timed",
};

export function PracticeSplitButton({
  pending,
  onStart,
}: {
  pending: boolean;
  onStart: (mode: SpRunMode) => void;
}) {
  const mode = useSyncExternalStore(
    subscribeLastPracticeMode,
    readLastPracticeMode,
    () => DEFAULT_PRACTICE_MODE,
  );
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

  function start() {
    setOpen(false);
    onStart(mode);
  }

  function choose(next: SpRunMode) {
    writeLastPracticeMode(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${lobbyCtaClassName}`}>
      <div className="flex overflow-hidden rounded-lg">
        <Button
          type="button"
          className="min-w-0 flex-1 rounded-none"
          disabled={pending}
          aria-label={`Start ${MODE_LABEL[mode].toLowerCase()} practice`}
          onClick={() => start()}
        >
          Practice: {MODE_LABEL[mode]}
        </Button>
        <Button
          type="button"
          size="icon"
          className="rounded-none border-l border-primary-foreground/25"
          disabled={pending}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Choose practice mode"
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
          {SP_RUN_MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={mode === option}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              disabled={pending}
              onClick={() => choose(option)}
            >
              {MODE_LABEL[option]}
              {mode === option ? (
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
