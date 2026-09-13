"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import {
  acceptInviteAction,
  declineInviteAction,
  getMatchHomeAction,
} from "@/lib/match/actions";
import { MATCH_UNEXPECTED_MESSAGE, matchErrorMessage } from "@/lib/match/error-copy";
import { MATCH_HOME_POLL_MS, type MatchHomeDto } from "@/lib/match/types";

export function useMatchHome() {
  const router = useRouter();
  const [matchHome, setMatchHome] = useState<MatchHomeDto | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);

  const requestMatchHome = useCallback((cancelled?: boolean) => {
    return getMatchHomeAction(readSessionId())
      .then((result) => {
        if (cancelled || !aliveRef.current) return;
        if (!result.ok) {
          if (result.code === "forbidden") sendToLogin();
          else {
            setMatchHome((prev) => prev ?? { rejoin: null, incomingInvites: [] });
          }
          return;
        }
        setMatchHome(result.data);
      })
      .catch(() => {
        if (cancelled || !aliveRef.current) return;
        setMatchHome((prev) => prev ?? { rejoin: null, incomingInvites: [] });
      });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    void requestMatchHome(cancelled);
    const timer = window.setInterval(() => {
      void requestMatchHome(cancelled);
    }, MATCH_HOME_POLL_MS);
    return () => {
      cancelled = true;
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [requestMatchHome]);

  const acceptInvite = useCallback(
    async (matchId: string) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      setMessage(null);
      let started = false;
      try {
        const result = await acceptInviteAction(readSessionId(), matchId);
        if (!result.ok) {
          if (result.code === "forbidden") {
            sendToLogin();
            return;
          }
          setMessage(matchErrorMessage(result.code));
          return;
        }
        started = true;
        router.push(`/match/${result.data.matchId}`);
      } catch {
        setMessage(MATCH_UNEXPECTED_MESSAGE);
      } finally {
        if (!started) {
          pendingRef.current = false;
          setPending(false);
        }
      }
    },
    [router],
  );

  const declineInvite = useCallback(async (matchId: string) => {
    setPending(true);
    setMessage(null);
    try {
      const result = await declineInviteAction(readSessionId(), matchId);
      if (!result.ok) {
        if (result.code === "forbidden") {
          sendToLogin();
          return;
        }
        setMessage(matchErrorMessage(result.code));
        return;
      }
      setMatchHome(result.data);
    } catch {
      setMessage(MATCH_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }, []);

  return {
    matchHome,
    matchReady: matchHome !== null,
    pending,
    message,
    acceptInvite,
    declineInvite,
  };
}
