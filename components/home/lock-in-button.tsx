"use client";

import { Button } from "@/components/ui/button";
import { lockInAction } from "@/lib/auth/actions/lock-in";
import { sendToLogin } from "@/lib/auth/send-to-login";
import { readSessionId } from "@/lib/auth/session-storage";

export function LockInButton() {
  return (
    <form
      action={async () => {
        const result = await lockInAction(readSessionId());
        if (result.ok) return;
        sendToLogin();
      }}
    >
      <Button type="submit">Lock in</Button>
    </form>
  );
}
