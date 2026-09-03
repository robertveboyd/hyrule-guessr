"use client";

import { useEffect, type ReactNode } from "react";

import { fetchExclusiveSessionActive } from "@/lib/auth/fetch-exclusive-session";
import {
  SessionChannelType,
  subscribeSessionChannel,
} from "@/lib/auth/session-channel";
import { requestExclusiveSessionLock } from "@/lib/auth/session-lock";
import { clearSessionId, readSessionId } from "@/lib/auth/session-storage";

const LOGIN_PATH = "/login";

function sendToLogin() {
  clearSessionId();
  window.location.replace(LOGIN_PATH);
}

export function ExclusiveSessionGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    const abort = new AbortController();

    void (async () => {
      const sessionId = readSessionId();
      if (sessionId) {
        const held = await requestExclusiveSessionLock(sessionId, abort.signal);
        if (abort.signal.aborted) return;
        if (!held) {
          sendToLogin();
          return;
        }
      }

      const active = await fetchExclusiveSessionActive();
      if (abort.signal.aborted) return;
      if (!active) sendToLogin();
    })();

    const unsubscribe = subscribeSessionChannel((message) => {
      if (message.type === SessionChannelType.signedOut) {
        sendToLogin();
        return;
      }

      if (readSessionId() === message.sessionId) return;

      sendToLogin();
    });

    return () => {
      abort.abort();
      unsubscribe();
    };
  }, []);

  return children;
}
