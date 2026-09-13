import { friendPresence } from "@/lib/friends/rules";

export function FriendAvatar({ username }: { username: string }) {
  const initial = (username.trim().slice(0, 1) || "?").toUpperCase();
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-amber/40 bg-hud text-sm text-amber"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function OnlineDot({
  online,
  busy = false,
}: {
  online: boolean;
  busy?: boolean;
}) {
  const state = friendPresence(online, busy);
  return (
    <span
      className={`inline-block size-2 rounded-full ${
        state === "online"
          ? "bg-p1"
          : state === "busy"
            ? "bg-amber"
            : "bg-muted-foreground/50"
      }`}
      aria-label={
        state === "online" ? "Online" : state === "busy" ? "Busy" : "Offline"
      }
    />
  );
}
