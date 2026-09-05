import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LockInButton } from "@/components/home/lock-in-button";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6">
      <h1 className="font-heading text-3xl">Hyrule Guessr</h1>
      <LockInButton />
      <SignOutButton />
      {process.env.NODE_ENV === "development" ? (
        <Link
          href="/map"
          className="text-sm text-amber underline-offset-4 hover:underline"
        >
          Map
        </Link>
      ) : null}
      <div className="flex gap-2">
        <span className="size-8 rounded-md bg-p1" />
        <span className="size-8 rounded-md bg-p2" />
        <span className="size-8 rounded-md bg-danger" />
      </div>
    </div>
  );
}
