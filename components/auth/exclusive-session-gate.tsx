"use client";

import { useEffect, useState, type ReactNode } from "react";

import { FriendsDock } from "@/components/friends/friends-dock";
import { HomeReadyProvider, useShowFriendsDock } from "@/components/lobby/home-ready";
import { connectUserSessionParty } from "@/lib/auth/connect-user-session";
import { fetchExclusiveSessionActive } from "@/lib/auth/fetch-exclusive-session";
import { sendToLogin } from "@/lib/auth/send-to-login";
import {
  SessionChannelType,
  subscribeSessionChannel,
} from "@/lib/auth/session-channel";
import { requestExclusiveSessionLock } from "@/lib/auth/session-lock";
import { readSessionId } from "@/lib/auth/session-storage";
import { usePresenceHeartbeat } from "@/lib/friends/use-presence-heartbeat";

export function ExclusiveSessionGate({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <HomeReadyProvider>
      <ExclusiveSessionGateBody userId={userId}>{children}</ExclusiveSessionGateBody>
    </HomeReadyProvider>
  );
}

function ExclusiveSessionGateBody({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [socketOpen, setSocketOpen] = useState(false);
  const showFriendsDock = useShowFriendsDock();
  usePresenceHeartbeat(socketOpen);

  useEffect(() => {
    const abort = new AbortController();
    let kicked = false;
    let unsubscribeParty = () => {};

    const onKicked = () => {
      if (kicked) return;
      kicked = true;
      setSocketOpen(false);
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
          onSocketOpen: () => {
            if (!abort.signal.aborted) setSocketOpen(true);
          },
          onSocketClose: () => {
            if (!abort.signal.aborted) setSocketOpen(false);
          },
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
      setSocketOpen(false);
      unsubscribeChannel();
      unsubscribeParty();
    };
  }, [userId]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {children}
      {showFriendsDock ? <FriendsDock /> : null}
    </div>
  );
}
