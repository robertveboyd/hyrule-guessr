"use client";

import { Button } from "@/components/ui/button";
import { lockInAction } from "@/lib/auth/actions/lock-in";
import { clearSessionId, readSessionId } from "@/lib/auth/session-storage";

const LOGIN_PATH = "/login";

export function LockInButton() {
  return (
    <form
      action={async () => {
        const result = await lockInAction(readSessionId());
        if (result.ok) return;
        clearSessionId();
        window.location.replace(LOGIN_PATH);
      }}
    >
      <Button type="submit">Lock in</Button>
    </form>
  );
}
