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

export function RoundTimer({
  endsAt,
  onExpire,
  className,
}: {
  endsAt: string | null;
  onExpire?: () => void;
  className?: string;
}) {
  const [ms, setMs] = useState(() =>
    endsAt ? remainingMs(endsAt, Date.now()) : 0,
  );
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
    if (!endsAt) return;
    const tick = () => {
      const next = remainingMs(endsAt, Date.now());
      setMs(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
    };
    const timeout = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(id);
    };
  }, [endsAt]);

  if (!endsAt) return null;
  return (
    <p
      className={cn(
        "font-heading text-sm",
        ms === 0 ? "text-danger" : "text-amber",
        className,
      )}
      aria-live="polite"
    >
      {formatRemaining(ms)}
    </p>
  );
}
