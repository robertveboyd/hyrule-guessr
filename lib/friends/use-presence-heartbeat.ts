"use client";

import { useEffect } from "react";

import { readSessionId } from "@/lib/auth/session-storage";
import {
  clearPresenceAction,
  heartbeatPresenceAction,
} from "@/lib/friends/actions";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/friends/types";

export function usePresenceHeartbeat(socketOpen: boolean) {
  useEffect(() => {
    if (!socketOpen) return;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      void heartbeatPresenceAction(readSessionId());
    };

    beat();
    const timer = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void clearPresenceAction(readSessionId());
    };
  }, [socketOpen]);
}
