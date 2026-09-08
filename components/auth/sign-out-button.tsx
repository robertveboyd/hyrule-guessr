"use client";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions/sign-out";
import { postSignedOut } from "@/lib/auth/session-channel";
import { clearSessionId } from "@/lib/auth/session-storage";

function prepareSignOut() {
  clearSessionId();
  postSignedOut();
}

export function SignOutButton({
  variant = "outline",
  size = "default",
  className,
  disabled,
}: {
  variant?: "outline" | "ghost" | "link";
  size?: "default" | "sm";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <form className="contents" action={signOutAction} onSubmit={prepareSignOut}>
      <Button
        type="submit"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
      >
        Sign out
      </Button>
    </form>
  );
}

export function SignOutMenuItem({ disabled }: { disabled?: boolean }) {
  return (
    <form action={signOutAction} onSubmit={prepareSignOut}>
      <button
        type="submit"
        role="menuitem"
        disabled={disabled}
        className="block w-full cursor-pointer border-t border-amber/20 px-3 py-2 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
      >
        Sign out
      </button>
    </form>
  );
}
