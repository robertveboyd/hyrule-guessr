"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

function remainingMs(endsAt: string, now: number) {
  const parsed = Date.parse(endsAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed - now);
}

function formatRemaining(ms: number) {
  if (!Number.isFinite(ms)) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function useRemainingMs(endsAt: string | null) {
  const [ms, setMs] = useState(() =>
    endsAt ? remainingMs(endsAt, Date.now()) : 0,
  );

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setMs(remainingMs(endsAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return endsAt ? ms : 0;
}

export function RoundTimer({
  endsAt,
  onExpire,
  className,
  dangerBelowMs = 15_000,
}: {
  endsAt: string | null;
  onExpire?: () => void;
  className?: string;
  dangerBelowMs?: number;
}) {
  const ms = useRemainingMs(endsAt);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
  }, [endsAt]);

  useEffect(() => {
    if (!endsAt || ms > 0 || expiredRef.current) return;
    expiredRef.current = true;
    onExpireRef.current?.();
  }, [endsAt, ms]);

  if (!endsAt) return null;
  return (
    <p
      className={cn(
        "font-heading text-sm",
        ms > 0 && ms <= dangerBelowMs
          ? "text-danger"
          : ms === 0
            ? "text-danger"
            : "text-amber",
        className,
      )}
      aria-live="polite"
    >
      {formatRemaining(ms)}
    </p>
  );
}
