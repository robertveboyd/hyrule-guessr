"use client";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions/sign-out";
import { postSignedOut } from "@/lib/auth/session-channel";
import { clearSessionId } from "@/lib/auth/session-storage";

export function SignOutButton() {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearSessionId();
        postSignedOut();
      }}
    >
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
