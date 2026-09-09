"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FriendAvatar, OnlineDot } from "@/components/friends/friend-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";
import {
  acceptFriendAction,
  listFriendsAction,
  rejectFriendAction,
  requestFriendAction,
  searchUsersAction,
  unfriendAction,
} from "@/lib/friends/actions";
import {
  FRIENDS_UNEXPECTED_MESSAGE,
  friendsErrorMessage,
} from "@/lib/friends/error-copy";
import {
  FRIENDS_POLL_MS,
  SEARCH_MIN_CHARS,
  type FriendsListDto,
  type SearchHitDto,
} from "@/lib/friends/types";

function session() {
  return readSessionId();
}

export function FriendsPage() {
  const router = useRouter();
  const [list, setList] = useState<FriendsListDto | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHitDto[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fail = useCallback(
    (code: Parameters<typeof friendsErrorMessage>[0]) => {
      if (code === "forbidden") {
        sendToLogin();
        return;
      }
      setMessage(friendsErrorMessage(code));
    },
    [],
  );

  const applyList = useCallback((data: FriendsListDto) => {
    setMessage(null);
    setList(data);
    setHits((prev) =>
      prev
        ? prev.map((hit) => {
            if (data.friends.some((row) => row.id === hit.id)) {
              return { ...hit, relation: "friends" as const };
            }
            if (data.outgoing.some((row) => row.id === hit.id)) {
              return { ...hit, relation: "outgoing" as const };
            }
            if (data.incoming.some((row) => row.id === hit.id)) {
              return { ...hit, relation: "incoming" as const };
            }
            return { ...hit, relation: "none" as const };
          })
        : prev,
    );
  }, []);

  const loadList = useCallback(async () => {
    const result = await listFriendsAction(session());
    if (!result.ok) {
      fail(result.code);
      return;
    }
    applyList(result.data);
  }, [applyList, fail]);

  useEffect(() => {
    let cancelled = false;
    void listFriendsAction(session()).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        fail(result.code);
        return;
      }
      applyList(result.data);
    });
    const timer = window.setInterval(() => {
      void loadList();
    }, FRIENDS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyList, fail, loadList]);

  async function run(
    work: () => Promise<
      Awaited<ReturnType<typeof listFriendsAction>>
    >,
  ) {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await work();
      if (!result.ok) {
        fail(result.code);
        return;
      }
      applyList(result.data);
    } catch {
      setMessage(FRIENDS_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function search() {
    setPending(true);
    setMessage(null);
    try {
      const result = await searchUsersAction(session(), query);
      if (!result.ok) {
        fail(result.code);
        return;
      }
      setHits(result.data);
    } catch {
      setMessage(FRIENDS_UNEXPECTED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  const listBody = list ?? {
    friends: [],
    incoming: [],
    outgoing: [],
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl">Friends</h1>
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Home
        </Button>
      </div>
      {message ? (
        <p className="text-sm text-danger">{message}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Add friends</h2>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username"
            minLength={SEARCH_MIN_CHARS}
            aria-label="Search username"
          />
          <Button type="submit" disabled={pending || query.trim().length < SEARCH_MIN_CHARS}>
            Search
          </Button>
        </form>
        {hits ? (
          hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {hits.map((hit) => (
                <li
                  key={hit.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FriendAvatar username={hit.username} />
                    <span className="truncate">{hit.username}</span>
                  </span>
                  {hit.relation === "none" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run(() => requestFriendAction(session(), hit.id))
                      }
                    >
                      Add
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {hit.relation === "friends"
                        ? "Friends"
                        : hit.relation === "outgoing"
                          ? "Sent"
                          : "Incoming"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {listBody.incoming.length > 0 || listBody.outgoing.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Requests</h2>
          {listBody.incoming.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {listBody.incoming.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FriendAvatar username={user.username} />
                    <span className="truncate">{user.username}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void run(() => acceptFriendAction(session(), user.id))
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        void run(() => rejectFriendAction(session(), user.id))
                      }
                    >
                      Reject
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {listBody.outgoing.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {listBody.outgoing.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FriendAvatar username={user.username} />
                    <span className="truncate">{user.username}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Sent</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 pb-24">
        <h2 className="text-lg">Friends</h2>
        {listBody.friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {listBody.friends.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FriendAvatar username={user.username} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{user.username}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <OnlineDot online={user.online} />
                      {user.online ? "Online" : "Offline"}
                    </span>
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void run(() => unfriendAction(session(), user.id))
                  }
                >
                  Unfriend
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
