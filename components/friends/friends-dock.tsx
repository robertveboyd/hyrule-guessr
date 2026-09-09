"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { FriendAvatar, OnlineDot } from "@/components/friends/friend-avatar";
import { Button } from "@/components/ui/button";
import { readSessionId } from "@/lib/auth/session-storage";
import { listFriendsAction } from "@/lib/friends/actions";
import { hideFriendsDock } from "@/lib/friends/dock";
import { FRIENDS_POLL_MS, type FriendRowDto } from "@/lib/friends/types";

export function FriendsDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendRowDto[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const hidden = hideFriendsDock(pathname);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const tick = () => {
      void listFriendsAction(readSessionId()).then((result) => {
        if (cancelled || !result.ok) return;
        setFriends(result.data.friends);
      });
    };
    tick();
    const timer = window.setInterval(tick, FRIENDS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hidden]);

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

  if (hidden) return null;

  const onlineCount = friends.filter((friend) => friend.online).length;

  return (
    <div ref={rootRef} className="fixed right-3 bottom-3 z-40 w-64">
      {open ? (
        <div className="mb-1 max-h-80 overflow-hidden rounded-md border border-border bg-hud shadow-[0_8px_40px_rgb(0_0_0_/_.55)]">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm">Friends</p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/friends">Open</Link>
            </Button>
          </div>
          {friends.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No friends yet.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {friends.map((friend) => (
                <li
                  key={friend.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <FriendAvatar username={friend.username} />
                  <span className="min-w-0 flex-1 truncate">{friend.username}</span>
                  <OnlineDot online={friend.online} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Friends</span>
        <span className="text-xs text-muted-foreground">{onlineCount} online</span>
      </Button>
    </div>
  );
}
