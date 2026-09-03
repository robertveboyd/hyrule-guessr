"use client";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions/sign-out";
import { clearSessionId } from "@/lib/auth/session-storage";

export function SignOutButton() {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearSessionId();
      }}
    >
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
