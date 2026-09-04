import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ExclusiveSessionGate } from "@/components/auth/exclusive-session-gate";
import { auth } from "@/lib/auth";
import {
  CALLBACK_PATH_HEADER,
  loginPathWithCallback,
} from "@/lib/auth/login-url";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (typeof session?.user?.id !== "string") {
    redirect(
      loginPathWithCallback((await headers()).get(CALLBACK_PATH_HEADER)),
    );
  }

  return (
    <ExclusiveSessionGate userId={session.user.id}>
      {children}
    </ExclusiveSessionGate>
  );
}
