"use client";

import { useEffect, type ReactNode } from "react";

import { connectUserSessionParty } from "@/lib/auth/connect-user-session";
import { fetchExclusiveSessionActive } from "@/lib/auth/fetch-exclusive-session";
import { sendToLogin } from "@/lib/auth/send-to-login";
import {
  SessionChannelType,
  subscribeSessionChannel,
} from "@/lib/auth/session-channel";
import { requestExclusiveSessionLock } from "@/lib/auth/session-lock";
import { readSessionId } from "@/lib/auth/session-storage";

export function ExclusiveSessionGate({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const abort = new AbortController();
    let kicked = false;
    let unsubscribeParty = () => {};

    const onKicked = () => {
      if (kicked) return;
      kicked = true;
      sendToLogin();
    };

    void (async () => {
      try {
        const sessionId = readSessionId();
        if (sessionId) {
          const held = await requestExclusiveSessionLock(sessionId, abort.signal);
          if (abort.signal.aborted) return;
          if (!held) {
            onKicked();
            return;
          }
        }

        const active = await fetchExclusiveSessionActive();
        if (abort.signal.aborted) return;
        if (!active) {
          onKicked();
          return;
        }

        unsubscribeParty = await connectUserSessionParty({
          userId,
          onKicked,
        });
        if (abort.signal.aborted) unsubscribeParty();
      } catch {
        if (abort.signal.aborted) return;
        onKicked();
      }
    })();

    const unsubscribeChannel = subscribeSessionChannel((message) => {
      if (message.type === SessionChannelType.signedOut) {
        onKicked();
        return;
      }

      if (readSessionId() === message.sessionId) return;

      onKicked();
    });

    return () => {
      abort.abort();
      unsubscribeChannel();
      unsubscribeParty();
    };
  }, [userId]);

  return children;
}
