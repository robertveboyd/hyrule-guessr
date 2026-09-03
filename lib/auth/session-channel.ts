export const SESSION_CHANNEL_NAME = "hyrule-guessr.session";

export const SessionChannelType = {
  sessionReplaced: "sessionReplaced",
  signedOut: "signedOut",
} as const;

export type SessionChannelMessage =
  | {
      type: typeof SessionChannelType.sessionReplaced;
      sessionId: string;
    }
  | { type: typeof SessionChannelType.signedOut };

function isSessionChannelMessage(
  value: unknown,
): value is SessionChannelMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  if (value.type === SessionChannelType.signedOut) return true;
  return (
    value.type === SessionChannelType.sessionReplaced &&
    "sessionId" in value &&
    typeof value.sessionId === "string"
  );
}

function post(message: SessionChannelMessage) {
  const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

export function postSessionReplaced(sessionId: string) {
  post({ type: SessionChannelType.sessionReplaced, sessionId });
}

export function postSignedOut() {
  post({ type: SessionChannelType.signedOut });
}

export function subscribeSessionChannel(
  onMessage: (message: SessionChannelMessage) => void,
) {
  const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isSessionChannelMessage(event.data)) onMessage(event.data);
  };
  return () => channel.close();
}
